---
layout: home

hero:
 name: uight
 text: A component explorer inside your own dev server
 tagline: No second process, no second port, no config file. Open /uight and your components are already there.
 actions:
  - theme: brand
    text: Get started
    link: /guide/getting-started
  - theme: alt
    text: Coming from Storybook?
    link: /guide/storybook

features:
 - title: Zero configuration
   details: With no config and no fixtures, uight lists the components it finds — and the places your own code already uses them — as real, renderable states.
 - title: Your build, your providers
   details: It runs as a Vite plugin in the app's own server. The same aliases, the same CSS, the same Tailwind config. Nothing is mirrored into a second build.
 - title: Reads your Storybook
   details: CSF 3 is a declared subset, .storybook/preview is loaded, and anything uight will not run is badged rather than silently skipped.
 - title: Frame isolation
   details: Fixtures render in a separate realm, so a fixture's global styles and listeners cannot reach the explorer around it.
 - title: Controls you declared
   details: useFixtureInput at the call site. Controls are never inferred from a prop name, so a control that exists is one you meant.
 - title: Ejectable chrome
   details: Every chrome component is replaceable, and the registry ships the source under your own components directory when replacing is not enough.
---
