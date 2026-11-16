<script lang="ts">
    import './layout.css';
    import type { LayoutProps } from './$types';

    let { children }: LayoutProps = $props();
</script>

<svelte:head>
    <link rel="icon" href="/ft.svg" />
    <title>FileTransfer</title>
</svelte:head>

<div class="relative min-h-screen bg-black text-neutral-100 overflow-hidden">
  <div class="scene absolute inset-0 pointer-events-none z-0 overflow-hidden">
    <div class="grid-layer absolute left-1/2 top-1/2 w-[180vmax] h-[180vmax] ml-[-90vmax] mt-[-90vmax]
      bg-[linear-gradient(to_right,rgba(211,211,211,0.05)_2px,transparent_1px),linear-gradient(to_bottom,rgba(211,211,211,0.05)_2px,transparent_2px)]
      bg-size-[4rem_4rem]">
    </div>
    <div class="absolute inset-0 bg-[linear-gradient(to_left,#000_0%,rgba(0,0,0,0.7)_25%,transparent_60%)]"></div>
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_40%_50%,transparent_50%,#000_100%)]"></div>
  </div>

  <div class="relative z-10 min-h-screen flex flex-col">
    {@render children()}
  </div>
</div>

<style>
  .scene {
    perspective: 500px;
    perspective-origin: 70% 50%;
    --angleZ: 0deg;
    --angleX: 55deg;
  }

  @keyframes grid-move {
    from { transform: translateZ(0) rotateY(var(--angleX)) rotateZ(var(--angleZ)) translateX(0); }
    to   { transform: translateZ(0) rotateY(var(--angleX)) rotateZ(var(--angleZ)) translateX(-4rem); }
  }

  .grid-layer {
    animation: grid-move 10s linear infinite;
    will-change: transform;
    backface-visibility: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .grid-layer { animation: none; }
  }
</style>