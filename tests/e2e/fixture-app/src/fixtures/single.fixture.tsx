/**
 * A single-fixture file — §3.4's `names: [null]` case, which the integration log
 * in NOTES.md records as having been invisible in the tree at one point. A
 * browser-level assertion that it is selectable is the cheapest guard against
 * that class of regression coming back through a different door.
 */

export default <p data-e2e="single">SINGLE</p>;
