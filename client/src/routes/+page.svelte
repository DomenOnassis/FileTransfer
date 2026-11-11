<script lang="ts">
    import { goto } from '$app/navigation';

    let showHelp = $state(false);
    let copied = $state<string | null>(null);

    function startSession() {
        goto("/session");
    }

    function connectToSession() {
        goto("/connect")
    }

    async function copy(text: string) {
      try {
        await navigator.clipboard.writeText(text);
        copied = text;
        setTimeout(() => (copied = null), 1500);
      } catch {
        //
      }
    }
</script>

<svelte:head>
  <title>FileTransfer</title>
</svelte:head>

<main class="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center p-4">
  
  <h1 class="text-3xl font-mono tracking-widest uppercase mb-6 text-white">
    FileTransfer
  </h1>
  <!-- Button Container  -->
  <div class="w-full max-w-sm mt-5 flex items-center justify-center gap-10">
    <button 
      onclick={startSession}
      class="w-full bg-white text-black border border-white font-mono text-xs uppercase tracking-widest py-3 font-bold hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer"
    >
      Host
    </button>
    <button
      onclick={connectToSession}
      class="w-full bg-white text-black border border-white font-mono text-xs uppercase tracking-widest py-3 font-bold hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer"
    >
      Connect
    </button>
  </div>
  <!-- Help -->
   <button
    onclick={() => (showHelp = !showHelp)}
    aria-expanded={showHelp}
    aria-controls="help-panel"
    class="mt-8 font-mono text-xs uppercase tracking-widest text-neutral-400 hover:text-white underline underline-offset-4 transition-colors cursor-pointer"
  >
    {showHelp ? "Close help" : "Need help?"}
  </button>

  {#if showHelp}
    <section
      id="help-panel"
      class="w-full max-w-lg mt-4 border border-neutral-700 p-5 font-mono text-xs leading-relaxed text-neutral-300 space-y-5"
    >
      <div>
        <h2 class="uppercase tracking-widest text-white mb-2">Saving to a folder</h2>
        <p>
          Choosing a save folder uses the File System Access API. It works in
          Chrome and Edge on HTTPS or localhost. Firefox and Safari don't support
          it, so files are downloaded instead.
        </p>
        <p class="mt-2">
          Without folder access, each file is held in memory until it finishes,
          so very large files may not fit.
        </p>
      </div>

      <div>
        <h2 class="uppercase tracking-widest text-white mb-2">Brave: enable folder saving</h2>
        <p>Brave disables folder saving by default. Open this address and enable the flag:</p>
        <div class="mt-2 flex items-center gap-3">
          <code class="bg-neutral-900 px-2 py-1 text-white break-all">brave://flags/#file-system-access-api</code>
          <button
            onclick={() => copy("brave://flags/#file-system-access-api")}
            class="shrink-0 border border-neutral-600 px-2 py-1 uppercase tracking-widest hover:border-white hover:text-white transition-colors cursor-pointer"
          >
            {copied === "brave://flags/#file-system-access-api" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div>
        <h2 class="uppercase tracking-widest text-white mb-2">Brave: devices can't connect</h2>
        <p>
          On the same network, Brave's default WebRTC IP handling can stop two
          devices from connecting. Open this address and set the WebRTC IP
          handling policy to "Default":
        </p>
        <div class="mt-2 flex items-center gap-3">
          <code class="bg-neutral-900 px-2 py-1 text-white break-all">brave://settings/privacy</code>
          <button
            onclick={() => copy("brave://settings/privacy")}
            class="shrink-0 border border-neutral-600 px-2 py-1 uppercase tracking-widest hover:border-white hover:text-white transition-colors cursor-pointer"
          >
            {copied === "brave://settings/privacy" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div>
        <h2 class="uppercase tracking-widest text-white mb-2">Still not connecting?</h2>
        <p>
          Some corporate networks and mobile data connections block direct
          connections between devices. Try a different network, such as Wi-Fi
          instead of mobile data.
        </p>
      </div>
    </section>
  {/if}
</main>