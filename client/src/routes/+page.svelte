<script lang="ts">
    import { goto } from '$app/navigation';

    function startSession() {
        // TODO: logic
        goto("/session");
    }

    function connectToSession() {
        // TODO: logic
        goto("/connect")
    }
</script>

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

</main>