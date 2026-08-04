/**
 * Two small domain types, here to exercise SPEC §7.7.
 *
 * Both are **class instances** on purpose. §7.3 sends getters, proxies and
 * non-plain objects across the wire as `opaque`, which means a control panel
 * shows them as an uneditable chip. That is the exact failure §7.7 exists to
 * fix, and you cannot demonstrate the fix with a plain object literal — a plain
 * object already serializes structurally and needs no codec at all.
 */

export const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "JPY"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Currencies with no minor unit. Amounts are integers of the major unit. */
const ZERO_DECIMAL: ReadonlySet<string> = new Set(["JPY"]);

const SYMBOLS: Record<Currency, string> = {
	USD: "$",
	EUR: "€",
	GBP: "£",
	AUD: "A$",
	JPY: "¥",
};

/** An amount of money, stored in minor units so arithmetic stays exact. */
export class Money {
	readonly currency: Currency;
	readonly minorUnits: number;

	constructor(currency: Currency, minorUnits: number) {
		this.currency = currency;
		this.minorUnits = Math.round(minorUnits);
	}

	static fromMajor(currency: Currency, major: number): Money {
		return new Money(currency, major * Money.scale(currency));
	}

	static scale(currency: Currency): number {
		return ZERO_DECIMAL.has(currency) ? 1 : 100;
	}

	get major(): number {
		return this.minorUnits / Money.scale(this.currency);
	}

	format(): string {
		const digits = ZERO_DECIMAL.has(this.currency) ? 0 : 2;
		return `${SYMBOLS[this.currency]}${this.major.toFixed(digits)}`;
	}
}

/**
 * A branded stock-keeping unit. Display-only in the panel: there is no safe
 * generic editor for an identifier whose validity is a server's opinion, and
 * §7.7 allows a codec to omit `editor` for exactly that case.
 */
export class Sku {
	readonly value: string;

	constructor(value: string) {
		this.value = value;
	}

	format(): string {
		return this.value.toUpperCase();
	}
}
