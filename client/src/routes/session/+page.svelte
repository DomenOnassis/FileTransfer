<script lang="ts">
  let sessionId = $state("0123456");
  let sessionPwd = $state("asdfghi");
  let connectedPeers = $state<string[]>([]);
  let files = $state<File[]>([]);
  let isTransmitting = $state(false);
  let progress = $state(0);

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      files = [...files, ...Array.from(input.files)];
    }
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  function sendFiles() {
    if (files.length === 0) return;
    isTransmitting = true;
    progress = 0;
  }
</script>

<main class="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center p-4">
  
  <h1 class="text-3xl font-mono tracking-widest uppercase mb-6 text-white">
    FileTransfer
  </h1>

  <!-- Back Button -->
  <div class="w-full max-w-md flex justify-start mb-4">
    <a 
      href="/" 
      class="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-neutral-400 hover:text-white transition-colors"
    >
      <span>←</span>
      <span>Back</span>
    </a>
  </div>

  <div class="w-full max-w-md bg-neutral-950 border border-neutral-800 rounded-none p-6 shadow-2xl space-y-6">

    <!-- Status Indicator -->
    <div class="flex items-center justify-between border-b border-neutral-800 pb-3">
      <span class="text-xs font-mono uppercase tracking-widest text-neutral-400">
        // Status
      </span>
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-white animate-pulse"></span>
        <span class="text-xs font-mono uppercase tracking-wider text-white">
          {connectedPeers.length > 0 ? `Connected (${connectedPeers.length})` : 'Waiting for peers'}
        </span>
      </div>
    </div>

    <!-- User Avatar -->
    <div class="user flex justify-center">
      <div class="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center ring-1 ring-neutral-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-neutral-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    </div>

    <!-- Session Credentials -->
    <div class="sessionInfo space-y-3 bg-neutral-900/60 p-4 rounded-none border border-neutral-800">
      <div class="flex items-center justify-between text-sm">
        <span class="text-neutral-400 font-mono text-xs uppercase tracking-wider">Session ID</span>
        <code class="font-mono bg-neutral-950 px-2.5 py-1 rounded-none text-white font-semibold border border-neutral-800">
          {sessionId}
        </code>
      </div>

      <div class="flex items-center justify-between text-sm">
        <span class="text-neutral-400 font-mono text-xs uppercase tracking-wider">Password</span>
        <code class="font-mono bg-neutral-950 px-2.5 py-1 rounded-none text-white font-semibold border border-neutral-800">
          {sessionPwd}
        </code>
      </div>
    </div>

    <!-- Connected Peers List -->
    <div class="space-y-2">
      <span class="text-xs font-mono uppercase tracking-widest text-neutral-400 block">
        // Connected Devices
      </span>
      {#if connectedPeers.length === 0}
        <div class="p-3 bg-neutral-900/40 border border-neutral-800 text-center text-xs font-mono text-neutral-500 uppercase">
          No peers connected yet
        </div>
      {:else}
        <div class="space-y-1">
          {#each connectedPeers as peer}
            <div class="flex items-center justify-between p-2 bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-300">
              <span>{peer}</span>
              <span class="text-emerald-400 text-[10px] uppercase">Active</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- File Drop / Upload Zone -->
    <div class="space-y-2">
      <span class="text-xs font-mono uppercase tracking-widest text-neutral-400 block">
        // Select Files
      </span>
      <label class="flex flex-col items-center justify-center p-6 border border-dashed border-neutral-700 bg-neutral-900/40 hover:bg-neutral-900/80 transition-colors cursor-pointer text-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-neutral-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        <span class="text-xs font-mono text-neutral-300 uppercase tracking-wider">Choose or drop files</span>
        <input type="file" multiple onchange={handleFileSelect} class="hidden" />
      </label>
    </div>

    <!-- Selected Files Queue -->
    {#if files.length > 0}
      <div class="space-y-1 max-h-32 overflow-y-auto">
        {#each files as file, index}
          <div class="flex items-center justify-between p-2 bg-neutral-900 border border-neutral-800 text-xs font-mono">
            <span class="truncate max-w-[200px] text-neutral-200">{file.name}</span>
            <div class="flex items-center gap-2">
              <span class="text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
              <button onclick={() => removeFile(index)} class="text-neutral-500 hover:text-white border-none bg-transparent p-0">
                ✕
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <!-- Live Progress Indicator -->
    {#if isTransmitting}
      <div class="space-y-1">
        <div class="flex justify-between text-xs font-mono text-neutral-400 uppercase">
          <span>Transmitting...</span>
          <span>{progress}%</span>
        </div>
        <div class="w-full bg-neutral-900 border border-neutral-800 h-2">
          <div class="bg-white h-full transition-all duration-200" style="width: {progress}%"></div>
        </div>
      </div>
    {/if}

    <!-- Action Button -->
    <button 
      onclick={sendFiles}
      disabled={files.length === 0}
      class="w-full bg-white text-black border border-white font-mono text-xs uppercase tracking-widest py-3 font-bold hover:bg-neutral-200 disabled:opacity-30 disabled:hover:bg-white transition-colors cursor-pointer"
    >
      Send Encrypted Files
    </button>

  </div>

</main>