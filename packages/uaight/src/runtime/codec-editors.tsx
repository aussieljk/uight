/**
 * Editors for the built-in codecs — SPEC.md §7.7, Q6.
 *
 * `serialize`/`deserialize`/`test` run in the renderer realm; `editor` renders
 * in the UI realm. Keeping the editors in their own module is what lets the
 * renderer chunk stay free of them rather than relying on tree-shaking to
 * notice — `runtime/index.ts` deliberately does not re-export this file.
 *
 * The UI imports `withBuiltinEditors` and attaches these to the codec list it
 * shows in the control panel.
 */

import * as React from "react";
import type { CodecEditorProps, FixtureCodec } from "../shared/types.ts";
import type { FileData, RegExpData } from "./codecs.ts";

type AnyCodecEditor = React.ComponentType<CodecEditorProps<any>>;

/* ------------------------------------------------------------------ *
 * Date — an instant, shown in local time with a UTC toggle (§7.3)
 * ------------------------------------------------------------------ */

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

function toLocalInput(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

function toUtcInput(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	return date.toISOString().slice(0, 16);
}

export function DateCodecEditor(props: CodecEditorProps<string>): React.ReactElement {
	const [utc, setUtc] = React.useState(false);
	const value = utc ? toUtcInput(props.value) : toLocalInput(props.value);

	const onChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
		const raw = event.target.value;
		if (!raw) return;
		const date = new Date(utc ? `${raw}:00Z` : raw);
		if (Number.isNaN(date.getTime())) return;
		props.onChange(date.toISOString());
	};

	return (
		<div className="uaight-codec-editor uaight-codec-date">
			<input
				type="datetime-local"
				aria-label={props.label}
				value={value}
				disabled={props.disabled}
				onChange={onChange}
			/>
			<label className="uaight-codec-date-utc">
				<input
					type="checkbox"
					checked={utc}
					disabled={props.disabled}
					onChange={(event) => setUtc(event.target.checked)}
				/>
				UTC
			</label>
			{/* We store instants, not wall times — say so where it matters. */}
			<span className="uaight-codec-hint" title={props.value}>
				{props.value || "—"}
			</span>
		</div>
	);
}

/* ------------------------------------------------------------------ *
 * RegExp
 * ------------------------------------------------------------------ */

export function RegExpCodecEditor(
	props: CodecEditorProps<RegExpData>,
): React.ReactElement {
	return (
		<div className="uaight-codec-editor uaight-codec-regexp">
			<span aria-hidden>/</span>
			<input
				type="text"
				aria-label={`${props.label} pattern`}
				value={props.value.source}
				disabled={props.disabled}
				onChange={(event) => props.onChange({ ...props.value, source: event.target.value })}
			/>
			<span aria-hidden>/</span>
			<input
				type="text"
				className="uaight-codec-regexp-flags"
				aria-label={`${props.label} flags`}
				value={props.value.flags}
				disabled={props.disabled}
				onChange={(event) =>
					props.onChange({
						...props.value,
						flags: event.target.value.replace(/[^dgimsuvy]/g, ""),
					})
				}
			/>
		</div>
	);
}

/* ------------------------------------------------------------------ *
 * URL
 * ------------------------------------------------------------------ */

export function UrlCodecEditor(props: CodecEditorProps<string>): React.ReactElement {
	const [draft, setDraft] = React.useState(props.value);
	const [committed, setCommitted] = React.useState(props.value);
	if (props.value !== committed) {
		setCommitted(props.value);
		setDraft(props.value);
	}

	const commit = (next: string): void => {
		setDraft(next);
		try {
			// Only a parseable URL is worth sending: the codec would throw.
			void new URL(next);
			props.onChange(next);
		} catch {
			/* keep typing */
		}
	};

	return (
		<input
			className="uaight-codec-editor uaight-codec-url"
			type="url"
			aria-label={props.label}
			value={draft}
			disabled={props.disabled}
			onChange={(event) => commit(event.target.value)}
		/>
	);
}

/* ------------------------------------------------------------------ *
 * Map and Set — JSON, because their contents are arbitrary
 * ------------------------------------------------------------------ */

function JsonCodecEditor<S>(props: CodecEditorProps<S>): React.ReactElement {
	const serialized = React.useMemo(() => {
		try {
			return JSON.stringify(props.value, null, 2);
		} catch {
			return "";
		}
	}, [props.value]);

	const [draft, setDraft] = React.useState(serialized);
	const [committed, setCommitted] = React.useState(serialized);
	const [invalid, setInvalid] = React.useState(false);

	if (serialized !== committed) {
		setCommitted(serialized);
		setDraft(serialized);
		setInvalid(false);
	}

	const onChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		const next = event.target.value;
		setDraft(next);
		try {
			const parsed = JSON.parse(next) as S;
			setInvalid(false);
			props.onChange(parsed);
		} catch {
			setInvalid(true);
		}
	};

	return (
		<textarea
			className="uaight-codec-editor uaight-codec-json"
			aria-label={props.label}
			aria-invalid={invalid || undefined}
			rows={4}
			spellCheck={false}
			value={draft}
			disabled={props.disabled}
			onChange={onChange}
		/>
	);
}

export const MapCodecEditor = JsonCodecEditor as AnyCodecEditor;
export const SetCodecEditor = JsonCodecEditor as AnyCodecEditor;

/* ------------------------------------------------------------------ *
 * File — display only. The bytes never left the renderer realm.
 * ------------------------------------------------------------------ */

export function FileCodecEditor(props: CodecEditorProps<FileData>): React.ReactElement {
	return (
		<div className="uaight-codec-editor uaight-codec-file" aria-label={props.label}>
			<span className="uaight-codec-file-name">{props.value.name}</span>
			<span className="uaight-codec-hint">
				{props.value.type || "unknown type"} · {props.value.size} bytes
			</span>
		</div>
	);
}

/* ------------------------------------------------------------------ *
 * Registry
 * ------------------------------------------------------------------ */

export const builtinCodecEditors: Record<string, AnyCodecEditor> = {
	date: DateCodecEditor as AnyCodecEditor,
	regexp: RegExpCodecEditor as AnyCodecEditor,
	url: UrlCodecEditor as AnyCodecEditor,
	map: MapCodecEditor,
	set: SetCodecEditor,
	file: FileCodecEditor as AnyCodecEditor,
};

/** A consumer's own `editor` always wins — this only fills the gaps. */
export function withBuiltinEditors(codecs: readonly FixtureCodec[]): FixtureCodec[] {
	return codecs.map((codec) => {
		if (codec.editor) return codec;
		const editor = builtinCodecEditors[codec.name];
		return editor ? { ...codec, editor } : codec;
	});
}
