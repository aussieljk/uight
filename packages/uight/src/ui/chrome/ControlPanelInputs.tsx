/**
 * ControlPanelInputs — the editors themselves. Ejectable (§11.3).
 *
 * SPEC.md §7.5: grouped by input, type-appropriate editors, keyboard-navigable
 * throughout — "a control panel needing a mouse fails job 2". Every editor
 * here is a native form control for exactly that reason.
 *
 * The panel edits WIRES, never values (§7.2). An edit produces one patch at
 * one path; the renderer applies it immutably to a fresh default. Opaque
 * leaves are display-only by type, which is why they can never be edited into
 * a stale reference across HMR.
 */

import {
	Badge,
	Button,
	Input,
	Select,
	Slider,
	Switch,
	Textarea,
	ToggleGroupRadioGroup,
	Typography,
} from "ljkui";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactElement, ReactNode } from "react";
import { useUightRoot } from "../root-context.ts";
import { applyPatches } from "../../shared/wire.ts";
import type {
	CodecEditorProps,
	ControlPanelInputsProps,
	EditableWire,
	FixtureCodec,
	InputOverlay,
	PathSegment,
	RegisteredInput,
	Wire,
} from "../../shared/types.ts";
import { pathKey } from "../../shared/wire.ts";
// §7.7, Q6 — the editors live in their own runtime module precisely so the
// renderer chunk never pulls them in; the UI is the only importer.
import { builtinCodecEditors } from "../../runtime/codec-editors.tsx";
import { FOCUS_RING, MOTION, cx } from "../cx.ts";
import {
	childrenOf,
	formatJson,
	isBranch,
	isJsonSafe,
	jsToWire,
	shapeOf,
	typeLabel,
	wireLabel,
} from "../wire-view.ts";

// The props of an ejectable component are published surface (§11.3), so the
// declaration lives with the other published types and is re-exported here.
export type { ControlPanelInputsProps } from "../../shared/types.ts";

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

/**
 * The panel is a dense side pane, so every ljkui control here is size `1` —
 * stated once rather than repeated as a magic string at each call site.
 */
const SIZE = "1" as const;

/** A value the panel can show but not edit (§7.2). */
function Chip({
	children,
	title,
}: {
	children: ReactNode;
	title?: string;
}): ReactElement {
	return (
		<Badge size={SIZE} variant="soft" color="gray" title={title}>
			{children}
		</Badge>
	);
}

/**
 * A text field that reports every keystroke, while keeping the keystroke itself
 * as local state.
 *
 * It used to report only on blur or Enter, which made §7.5's "every control is
 * live" false for exactly the editors people use most: typing into `label` and
 * looking at the preview showed the module default until focus moved somewhere
 * else, with nothing on screen saying why. The reason for the delay — "typing
 * must never fight the renderer" — is real but is answered by the `draft`
 * state, not by withholding the patch: the panel edits the host's overlay store
 * synchronously (§7.2 step 4 happens in the renderer, off the keystroke path),
 * so `props.value` comes back equal to what was typed within the same commit
 * and the effect below is a no-op. Callers that can reject a value — number,
 * bigint, JSON — still validate before calling `onCommit`, so a half-typed
 * `-` or `1e` simply does not produce a patch.
 */
function TextField(props: {
	value: string;
	onCommit: (next: string) => void;
	type?: string;
	disabled?: boolean;
	multiline?: boolean;
	label: string;
	step?: number | undefined;
	min?: number | undefined;
	max?: number | undefined;
}): ReactElement {
	const [draft, setDraft] = useState(props.value);
	useEffect(() => setDraft(props.value), [props.value]);

	const commit = () => {
		if (draft !== props.value) props.onCommit(draft);
	};

	/** Live. `commit` stays on blur and Enter as the backstop for a rejected draft. */
	const edit = (next: string) => {
		setDraft(next);
		if (next !== props.value) props.onCommit(next);
	};

	if (props.multiline) {
		return (
			<Textarea
				size={SIZE}
				aria-label={props.label}
				value={draft}
				rows={3}
				disabled={props.disabled}
				onChange={(e) => edit(e.target.value)}
				onBlur={commit}
			/>
		);
	}

	return (
		<Input.Control
			size={SIZE}
			aria-label={props.label}
			type={props.type ?? "text"}
			value={draft}
			disabled={props.disabled}
			step={props.step}
			min={props.min}
			max={props.max}
			onChange={(e) => edit(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					commit();
				} else if (e.key === "Escape") {
					e.preventDefault();
					setDraft(props.value);
				}
			}}
		/>
	);
}

/* ------------------------------------------------------------------ *
 * One node of one input's value
 * ------------------------------------------------------------------ */

interface NodeProps {
	wire: Wire;
	path: PathSegment[];
	/** Always meaningful: it is the editor's accessible name. */
	label: string;
	/** True at the root of an input, where the section heading already names it. */
	hideLabel?: boolean;
	input: RegisteredInput;
	disabled: boolean;
	codecs: FixtureCodec[];
	depth: number;
	onSet: (path: PathSegment[], value: EditableWire) => void;
}

function optionWires(input: RegisteredInput): Wire[] | null {
	const options = input.options?.options;
	return options && options.length ? options : null;
}

function Editor(props: NodeProps): ReactElement {
	const { wire, path, label, input, disabled, codecs, onSet } = props;
	// Every popup the panel opens has to portal inside the mount, or it lands
	// outside our scoped stylesheet and comes out unstyled (§10.3).
	const rootEl = useUightRoot();
	const atRoot = path.length === 0;
	const options = atRoot ? optionWires(input) : null;
	const control = atRoot ? (input.options?.control ?? "auto") : "auto";
	const shape = control !== "auto" && control ? control : shapeOf(wire, options !== null);

	// select / radio — §7.6, options are declared at the call site.
	//
	// Both are keyed by the option's INDEX, not by its label: two options can
	// render the same label (`0` and `"0"`), and choosing by label would send
	// whichever came first for either of them.
	if (options && (shape === "select" || shape === "radio")) {
		const current = wireLabel(wire);
		const currentIndex = options.findIndex((o) => wireLabel(o) === current);
		const choose = (index: number): void => {
			const option = options[index];
			if (option && option.t !== "opaque") onSet(path, option);
		};

		if (shape === "radio") {
			return (
				<ToggleGroupRadioGroup.Root
					aria-label={label}
					name={`${input.name}-${pathKey(path)}`}
					disabled={disabled}
					value={currentIndex}
					onValueChange={(next) => choose(Number(next))}
				>
					{options.map((option, i) => (
						<ToggleGroupRadioGroup.Item key={i} value={i}>
							{wireLabel(option)}
						</ToggleGroupRadioGroup.Item>
					))}
				</ToggleGroupRadioGroup.Root>
			);
		}
		return (
			<Select.Root
				size={SIZE}
				value={currentIndex}
				disabled={disabled}
				onValueChange={(next) => choose(Number(next))}
			>
				<Select.Trigger aria-label={label} className="w-full" />
				<Select.Content container={rootEl}>
					{/* §7.2 — a value edited away from every declared option still has
					    to be shown, or the trigger would read as one of them. */}
					{currentIndex === -1 ? <Select.Item value={-1}>{current}</Select.Item> : null}
					{options.map((option, i) => (
						<Select.Item key={i} value={i}>
							{wireLabel(option)}
						</Select.Item>
					))}
				</Select.Content>
			</Select.Root>
		);
	}

	switch (wire.t) {
		case "opaque":
			// Never editable, by type (§7.2). Say so rather than showing a dead field.
			return <Chip title="This value cannot cross the realm boundary.">{wire.label}</Chip>;

		case "undef":
			return (
				<div className="flex items-center gap-1">
					<Chip>undefined</Chip>
					<Button
						size={SIZE}
						variant="ghost"
						color="gray"
						disabled={disabled}
						onClick={() => onSet(path, { t: "prim", v: "" })}
					>
						set a value
					</Button>
				</div>
			);

		case "bigint":
			return (
				<TextField
					label={label}
					value={wire.v}
					disabled={disabled}
					onCommit={(next) => {
						if (/^-?\d+$/.test(next.trim())) onSet(path, { t: "bigint", v: next.trim() });
					}}
				/>
			);

		case "codec": {
			// A consumer's own editor always wins; the built-ins only fill gaps.
			const codec = codecs.find((c) => c.name === wire.codec);
			const CodecEditor = (codec?.editor ?? builtinCodecEditors[wire.codec]) as
				| ComponentType<CodecEditorProps<unknown>>
				| undefined;

			if (!CodecEditor) {
				// §7.7 — display-only is a legitimate codec, and an unknown codec
				// name degrades rather than breaking the panel.
				return (
					<Chip title={`No editor is registered for the "${wire.codec}" codec.`}>
						{wireLabel(wire)}
					</Chip>
				);
			}
			return (
				<CodecEditor
					value={wire.v}
					label={label}
					disabled={disabled}
					onChange={(next: unknown) => onSet(path, { t: "codec", codec: wire.codec, v: next })}
				/>
			);
		}

		case "prim": {
			if (typeof wire.v === "boolean" || shape === "checkbox") {
				const checked = wire.v === true;
				return (
					<span className="inline-flex items-center gap-2">
						<Switch
							size={SIZE}
							aria-label={label}
							checked={checked}
							disabled={disabled}
							onCheckedChange={(next) => onSet(path, { t: "prim", v: next })}
						/>
						{/* The literal, not "on"/"off": the panel edits a value, and
						    `false` and `undefined` are different things here (§7.2). */}
						<Typography.Text size={SIZE} color="gray">
							{checked ? "true" : "false"}
						</Typography.Text>
					</span>
				);
			}

			if (typeof wire.v === "number" || shape === "number" || shape === "range") {
				const numeric = typeof wire.v === "number" ? wire.v : 0;
				const opts = atRoot ? input.options : undefined;
				if (shape === "range") {
					return (
						<div className="flex items-center gap-2">
							<Slider
								size={SIZE}
								aria-label={label}
								value={numeric}
								min={opts?.min ?? 0}
								max={opts?.max ?? 100}
								step={opts?.step ?? 1}
								disabled={disabled}
								onValueChange={(next) => {
									// A single-thumb slider still reports an array on some paths.
									const v = Array.isArray(next) ? next[0] : next;
									if (typeof v === "number") onSet(path, { t: "prim", v });
								}}
								className="min-w-0 flex-1"
							/>
							<Typography.Text
								size={SIZE}
								color="gray"
								className="w-10 shrink-0 text-right tabular-nums"
							>
								{numeric}
							</Typography.Text>
						</div>
					);
				}
				return (
					<TextField
						label={label}
						type="number"
						value={String(numeric)}
						disabled={disabled}
						step={opts?.step}
						min={opts?.min}
						max={opts?.max}
						onCommit={(next) => {
							const parsed = Number(next);
							if (next.trim() !== "" && Number.isFinite(parsed)) {
								onSet(path, { t: "prim", v: parsed });
							}
						}}
					/>
				);
			}

			const text = wire.v === null ? "" : String(wire.v);
			if (shape === "color") {
				return (
					<div className="flex items-center gap-1">
						{/* The one control with no ljkui equivalent: a colour well is a
						    native widget, and rebuilding one would be a worse picker
						    than the platform's. The field beside it is ljkui's. */}
						<input
							type="color"
							aria-label={label}
							value={/^#[0-9a-f]{6}$/i.test(text) ? text : "#000000"}
							disabled={disabled}
							onChange={(e) => onSet(path, { t: "prim", v: e.target.value })}
							className={cx(
								"h-6 w-8 shrink-0 rounded-sm border border-[var(--u-line)] bg-[var(--u-bg)] p-0.5",
								FOCUS_RING,
							)}
						/>
						<TextField
							label={`${label} value`}
							value={text}
							disabled={disabled}
							onCommit={(next) => onSet(path, { t: "prim", v: next })}
						/>
					</div>
				);
			}
			if (shape === "date") {
				return (
					<TextField
						label={label}
						type="date"
						value={text}
						disabled={disabled}
						onCommit={(next) => onSet(path, { t: "prim", v: next })}
					/>
				);
			}
			return (
				<TextField
					label={label}
					value={text}
					multiline={shape === "textarea"}
					disabled={disabled}
					onCommit={(next) => onSet(path, { t: "prim", v: next })}
				/>
			);
		}

		case "array":
		case "object":
			return <Chip>{wireLabel(wire)}</Chip>;
	}
}

/** A collapsible tree for arrays and objects (§7.5). */
function Branch(props: NodeProps): ReactElement {
	const [open, setOpen] = useState(props.depth < 1);
	const rows = childrenOf(props.wire);

	return (
		<div>
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className={cx(
					"flex h-6 w-full items-center gap-1 rounded-sm px-1 text-left text-xs text-[var(--u-fg-muted)]",
					"hover:bg-[var(--u-bg-hover)]",
					FOCUS_RING,
					MOTION,
				)}
			>
				<span aria-hidden="true" className="w-3 shrink-0 text-[var(--u-fg-subtle)]">
					{open ? "−" : "+"}
				</span>
				<span className="truncate">{props.label}</span>
				<span className="ml-auto shrink-0 text-[var(--u-fg-subtle)]">
					{wireLabel(props.wire)}
				</span>
			</button>
			{open ? (
				<div className="ml-2 border-l border-[var(--u-line)] pl-2">
					{rows.map(([segment, label, child]) => (
						<Node
							key={`${typeof segment}:${String(segment)}`}
							{...props}
							wire={child}
							label={label}
							hideLabel={false}
							path={[...props.path, segment]}
							depth={props.depth + 1}
						/>
					))}
					{rows.length === 0 ? (
						<Typography.Text render={<p />} size="1" color="gray" className="py-1">
							empty
						</Typography.Text>
					) : null}
				</div>
			) : null}
		</div>
	);
}

function Node(props: NodeProps): ReactElement {
	if (isBranch(props.wire)) return <Branch {...props} />;
	if (props.hideLabel || !props.label) return <Editor {...props} />;
	return (
		<div className="flex items-start gap-2 py-0.5">
			<span
				className="mt-1 w-16 shrink-0 truncate text-xs text-[var(--u-fg-subtle)]"
				title={props.label}
			>
				{props.label}
			</span>
			<div className="min-w-0 flex-1">
				<Editor {...props} />
			</div>
		</div>
	);
}

/* ------------------------------------------------------------------ *
 * One input
 * ------------------------------------------------------------------ */

function InputRow(props: {
	input: RegisteredInput;
	overlay: InputOverlay | undefined;
	codecs: FixtureCodec[];
	onSet: (name: string, path: PathSegment[], value: EditableWire) => void;
	onReset: (name?: string) => void;
}): ReactElement {
	const { input, overlay, codecs, onSet, onReset } = props;
	const [jsonMode, setJsonMode] = useState(false);

	const value = useMemo(
		() => applyPatches(input.wire, overlay?.patches ?? []).wire,
		[input.wire, overlay],
	);

	const label = input.options?.label ?? input.name;
	const edited = (overlay?.patches.length ?? 0) > 0;
	const disabled = !input.active;
	const branch = isBranch(value);
	const canJson = isJsonSafe(value);
	const wantsJson = input.options?.control === "json";

	const set = (path: PathSegment[], next: EditableWire) => onSet(input.name, path, next);

	return (
		<section
			className={cx(
				"border-b border-[var(--u-line)] px-3 py-2 last:border-b-0",
				disabled ? "opacity-50" : "",
			)}
			aria-label={label}
		>
			<div className="flex h-6 items-center gap-2">
				<Typography.Text size="1" weight="medium" className="truncate" title={input.name}>
					{label}
				</Typography.Text>
				<Typography.Text size="1" color="gray" className="shrink-0">
					{typeLabel(value)}
				</Typography.Text>
				{disabled ? (
					// §7.3 — an unregistered input keeps its overlay and shows greyed.
					<Badge
						size="1"
						variant="soft"
						color="gray"
						title="This input was not registered by the latest render. Its setting is kept."
					>
						inactive
					</Badge>
				) : null}

				<div className="ml-auto flex shrink-0 items-center gap-0.5">
					{(branch || wantsJson) && canJson ? (
						<Button
							size="1"
							variant={jsonMode ? "soft" : "ghost"}
							color={jsonMode ? undefined : "gray"}
							aria-pressed={jsonMode}
							onClick={() => setJsonMode((v) => !v)}
						>
							JSON
						</Button>
					) : null}
					{edited ? (
						<Button
							size="1"
							variant="ghost"
							onClick={() => onReset(input.name)}
							title="Reset to this module's current default"
						>
							Reset
						</Button>
					) : null}
				</div>
			</div>

			{input.options?.description ? (
				<Typography.Text render={<p />} size="1" color="gray" className="mb-1">
					{input.options.description}
				</Typography.Text>
			) : null}

			<div className="mt-1">
				{jsonMode || (wantsJson && canJson) ? (
					<JsonEditor
						label={label}
						wire={value}
						disabled={disabled}
						onCommit={(next) => set([], next)}
					/>
				) : (
					<Node
						wire={value}
						path={[]}
						label={label}
						hideLabel={!branch}
						input={input}
						disabled={disabled}
						codecs={codecs}
						depth={0}
						onSet={set}
					/>
				)}
			</div>
		</section>
	);
}

function JsonEditor(props: {
	label: string;
	wire: Wire;
	disabled: boolean;
	onCommit: (value: EditableWire) => void;
}): ReactElement {
	const initial = useMemo(() => formatJson(props.wire), [props.wire]);
	const [draft, setDraft] = useState(initial);
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		setDraft(initial);
		setError(null);
	}, [initial]);

	const commit = () => {
		if (draft === initial) return;
		try {
			const wire = jsToWire(JSON.parse(draft) as unknown);
			if (!wire) {
				setError("That value cannot be sent to the preview.");
				return;
			}
			setError(null);
			props.onCommit(wire);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Invalid JSON.");
		}
	};

	return (
		<div>
			<Textarea
				size="1"
				color={error ? "danger" : undefined}
				aria-label={`${props.label} as JSON`}
				aria-invalid={error !== null}
				value={draft}
				rows={Math.min(12, draft.split("\n").length + 1)}
				disabled={props.disabled}
				spellCheck={false}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={commit}
				className="resize-y"
			/>
			{error ? (
				<Typography.Text render={<p />} size="1" color="danger" className="mt-1">
					{error}
				</Typography.Text>
			) : null}
		</div>
	);
}

/* ------------------------------------------------------------------ *
 * The list
 * ------------------------------------------------------------------ */

export function ControlPanelInputs({
	inputs,
	overlay,
	onSet,
	onReset,
	codecs = [],
}: ControlPanelInputsProps): ReactElement {
	const overlays = useMemo(() => new Map(overlay.map((o) => [o.input, o])), [overlay]);

	return (
		<div>
			{inputs.map((input) => (
				<InputRow
					key={input.name}
					input={input}
					overlay={overlays.get(input.name)}
					codecs={codecs}
					onSet={onSet}
					onReset={onReset}
				/>
			))}
		</div>
	);
}
