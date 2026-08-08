/**
 * ControlPanel — the frame around the editors. Ejectable (§11.3).
 *
 * §7.5. The panel is hidden by the explorer when a fixture registers no
 * inputs, so this file always has something to show. `ControlPanelInputs` is a
 * separate ejectable, reached through `ControlPanelSlots` rather than through
 * props: `ControlPanelProps` is part of the published surface (§19.5) and is
 * not ours to widen.
 */

import { Alert, Button, Typography } from "ljkui";
import { createContext, useContext } from "react";
import type { ComponentType, ReactElement } from "react";
import type { ControlPanelProps, FixtureCodec } from "../../shared/types.ts";
import { summarizeDropped } from "../dropped.ts";
import { ControlPanelInputs } from "./ControlPanelInputs.tsx";
import type { ControlPanelInputsProps } from "./ControlPanelInputs.tsx";

export interface ControlPanelSlotValue {
	codecs: FixtureCodec[];
	Inputs: ComponentType<ControlPanelInputsProps>;
}

export const ControlPanelSlots = createContext<ControlPanelSlotValue>({
	codecs: [],
	Inputs: ControlPanelInputs,
});

export function ControlPanel({
	inputs,
	overlay,
	onSet,
	onReset,
	droppedPatches,
	droppedInputs,
}: ControlPanelProps): ReactElement {
	const { codecs, Inputs } = useContext(ControlPanelSlots);
	const edited = overlay.some((o) => o.patches.length > 0);
	// §7.3 — the count was never the answer. `droppedInputs` carries the paths,
	// so the notice names what the user lost instead of tallying it.
	const dropped = summarizeDropped(droppedInputs ?? [], droppedPatches);

	return (
		<div className="flex h-full min-h-0 flex-col">
			<div className="flex h-9 shrink-0 items-center gap-2 border-b border-[var(--uight-line)] px-3">
				<Typography.Heading size="2" render={<h2 />}>
					Controls
				</Typography.Heading>
				<Typography.Text size="1" color="gray" className="tabular-nums">
					{inputs.length}
				</Typography.Text>
				{edited ? (
					<Button
						size="1"
						variant="ghost"
						onClick={() => onReset()}
						title="Reset every control to this module's current defaults"
						className="ml-auto"
					>
						Reset all
					</Button>
				) : null}
			</div>

			{droppedPatches > 0 ? (
				// §7.3 — patches whose path is no longer present in the new shape,
				// named: "`variant`, `size` and 2 more no longer apply".
				<Alert.Root
					role="status"
					color="warning"
					className="shrink-0 rounded-none border-x-0 border-t-0"
				>
					<Alert.Icon />
					<Alert.Description>
						{dropped.named.length === 0 ? (
							<>
								{droppedPatches} {droppedPatches === 1 ? "setting" : "settings"} {dropped.verb}.
							</>
						) : (
							<>
								{dropped.named.map((name, index) => (
									<span key={name}>
										{index === 0
											? null
											: dropped.more === 0 && index === dropped.named.length - 1
												? " and "
												: ", "}
										<Typography.Code size="1">{name}</Typography.Code>
									</span>
								))}
								{dropped.more > 0 ? ` and ${dropped.more} more` : null} {dropped.verb}.
							</>
						)}
					</Alert.Description>
				</Alert.Root>
			) : null}

			<div className="min-h-0 flex-1 overflow-auto">
				<Inputs
					inputs={inputs}
					overlay={overlay}
					onSet={onSet}
					onReset={onReset}
					codecs={codecs}
				/>
			</div>
		</div>
	);
}
