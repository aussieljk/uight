/**
 * Value codecs (SPEC §7.7), registered through
 * `uight({ codecs: "src/uight.codecs.tsx" })` in vite.config.ts.
 *
 * `test`, `serialize` and `deserialize` run in the **renderer realm**; `editor`
 * renders in the **UI realm**. They live in one module because a registry
 * object cannot cross a realm boundary — both realms import this file through
 * `virtual:uight/codecs`.
 *
 * Constraints this file is written to respect:
 *
 * - `serialize` output must be structured-cloneable. Both codecs below emit
 *   plain data, never a class instance and never a function.
 * - Codecs must be **pure**. §7.2's structural sharing assumes the renderer's
 *   value is untouched, so `deserialize` builds a new `Money` rather than
 *   mutating one, and `serialize` reads without side effects.
 * - Consumer codecs are tested before the built-ins, so ordering here is the
 *   ordering that wins. Neither of these overlaps a built-in.
 */

import { defineCodec } from "@aussieljk/uight";
import type { CodecEditorProps } from "@aussieljk/uight";
import * as React from "react";
import { CURRENCIES, type Currency, Money, Sku } from "./domain/money";

/** The wire shape for `Money`. Plain, cloneable, and versionless on purpose. */
interface MoneyWire {
	currency: Currency;
	minorUnits: number;
}

function MoneyEditor({ value, onChange, label, disabled }: CodecEditorProps<MoneyWire>) {
	const scale = Money.scale(value.currency);
	const major = value.minorUnits / scale;

	return (
		<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
			<select
				aria-label={`${label} currency`}
				disabled={disabled}
				value={value.currency}
				onChange={(event) => {
					// Changing currency keeps the major amount, not the minor units:
					// $12.00 becoming ¥12 is far less surprising than ¥1200.
					const currency = event.target.value as Currency;
					onChange({
						currency,
						minorUnits: Math.round(major * Money.scale(currency)),
					});
				}}
			>
				{CURRENCIES.map((currency) => (
					<option key={currency} value={currency}>
						{currency}
					</option>
				))}
			</select>
			<input
				aria-label={label}
				disabled={disabled}
				type="number"
				step={scale === 1 ? 1 : 0.01}
				value={major}
				onChange={(event) => {
					const next = Number(event.target.value);
					onChange({
						currency: value.currency,
						minorUnits: Number.isFinite(next) ? Math.round(next * scale) : 0,
					});
				}}
				style={{ width: "8ch" }}
			/>
		</div>
	);
}

export const codecs = [
	defineCodec<Money, MoneyWire>({
		name: "money",
		test: (value: unknown): value is Money => value instanceof Money,
		serialize: (value: Money): MoneyWire => ({
			currency: value.currency,
			minorUnits: value.minorUnits,
		}),
		deserialize: (data: MoneyWire): Money => new Money(data.currency, data.minorUnits),
		label: (value: Money) => value.format(),
		editor: MoneyEditor,
	}),

	/**
	 * Display-only: no `editor`, so the panel shows the label and nothing to
	 * type into. The value still round-trips, so a fixture reading it gets a
	 * real `Sku` rather than an opaque placeholder.
	 */
	defineCodec<Sku, string>({
		name: "sku",
		test: (value: unknown): value is Sku => value instanceof Sku,
		serialize: (value: Sku): string => value.value,
		deserialize: (data: string): Sku => new Sku(data),
		label: (value: Sku) => value.format(),
	}),
];
