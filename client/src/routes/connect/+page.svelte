<script lang="ts">
  let mySessionId = $state("123123AAA")
  let sessionIdInput = $state("");
  let sessionPwdInput = $state("");
  let isConnecting = $state(false);
  let isConnected = $state(false);
  let savePath = $state("");
  let incomingFiles = $state<Array<{ name: string; size: string; status: string; progress: number }>>([]);

  function handleConnect(e: SubmitEvent) {
    e.preventDefault();
    if (!sessionIdInput || !sessionPwdInput) return;
    
    isConnecting = true;

    // TODO: Initiate WebSockets handshake & host approval request
    setTimeout(() => {
      isConnecting = false;
      isConnected = true;
    }, 1500);
  }

  function disconnect() {
    isConnected = false;
    isConnecting = false;
    sessionIdInput = "";
    sessionPwdInput = "";
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
        // Connection
      </span>
      <div class="flex items-center gap-2">
        <span class={`w-2 h-2 rounded-full ${isConnected ? 'bg-white' : isConnecting ? 'bg-amber-400 animate-ping' : 'bg-neutral-600'}`}></span>
        <span class="text-xs font-mono uppercase tracking-wider text-white">
          {isConnected ? 'Connected to Host' : isConnecting ? 'Awaiting Approval...' : 'Disconnected'}
        </span>
      </div>
    </div>

    <div class="flex items-center justify-left gap-5 text-sm">
      <span class="text-neutral-400 font-mono text-xs uppercase tracking-wider">My ID</span>
      <code class="font-mono bg-neutral-950 px-2.5 py-1 rounded-none text-white font-semibold border border-neutral-800">
          {mySessionId}
      </code>
    </div>

    {#if !isConnected && !isConnecting}
      <!-- Connection Form -->
      <form onsubmit={handleConnect} class="w-full space-y-4">
        <div class="w-full flex flex-col gap-1.5 text-left">
          <label for="session-id" class="text-xs font-mono tracking-wider uppercase text-neutral-400 block">
            Session ID
          </label>
          <input 
            type="text" 
            id="session-id" 
            bind:value={sessionIdInput}
            placeholder="0123456" 
            class="w-full box-border px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-none font-mono text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 caret-white transition-colors"
            required
          />
        </div>

        <div class="w-full flex flex-col gap-1.5 text-left">
          <label for="session-pwd" class="text-xs font-mono tracking-wider uppercase text-neutral-400 block">
            Password
          </label>
          <input 
            type="password" 
            id="session-pwd" 
            bind:value={sessionPwdInput}
            placeholder="••••••••" 
            class="w-full box-border px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-none font-mono text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 caret-white transition-colors"
            required
          />
        </div>

        <button 
          type="submit"
          class="w-full bg-white text-black border border-white font-mono text-xs uppercase tracking-widest py-3 font-bold hover:bg-neutral-200 transition-colors cursor-pointer mt-2"
        >
          Connect to Session
        </button>
      </form>
    {:else if isConnecting}
      <!-- Waiting / Handshake State -->
      <div class="py-8 space-y-4 text-center">
        <div class="text-xs font-mono text-neutral-400 uppercase tracking-widest animate-pulse">
          Connecting to {sessionIdInput}...
        </div>
        <p class="text-xs font-mono text-neutral-500">
          Waiting for host to accept your connection request.
        </p>
        <button 
          onclick={disconnect}
          class="bg-neutral-900 border border-neutral-800 text-neutral-400 font-mono text-xs uppercase tracking-wider px-4 py-2 hover:bg-neutral-800 hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    {:else}
      <!-- Connected Receiver State -->
      <div class="space-y-6">
        
        <!-- Save Location Selector -->
        <div class="space-y-2">
          <span class="text-xs font-mono uppercase tracking-widest text-neutral-400 block">
            // Save Destination
          </span>
          <div class="flex gap-2 w-full">
            <input 
              type="text" 
              bind:value={savePath}
              placeholder="Select folder..." 
              readonly
              class="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-800 font-mono text-xs text-white placeholder-neutral-600 focus:outline-none"
            />
            <button 
              type="button"
              class="bg-neutral-900 border border-neutral-800 text-white font-mono text-xs uppercase px-3 py-2 hover:bg-neutral-800"
            >
              Browse
            </button>
          </div>
        </div>

        <!-- Incoming Files Receiver Stream -->
        <div class="space-y-2">
          <span class="text-xs font-mono uppercase tracking-widest text-neutral-400 block">
            // Incoming Files
          </span>
          
          {#if incomingFiles.length === 0}
            <div class="p-6 bg-neutral-900/40 border border-neutral-800 text-center text-xs font-mono text-neutral-500 uppercase">
              Ready to receive files...
            </div>
          {:else}
            <div class="space-y-2 max-h-48 overflow-y-auto">
              {#each incomingFiles as file}
                <div class="p-2.5 bg-neutral-900 border border-neutral-800 text-xs font-mono space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="truncate max-w-45 text-neutral-200">{file.name}</span>
                    <span class="text-neutral-500">{file.size}</span>
                  </div>
                  
                  <div class="space-y-1">
                    <div class="flex justify-between text-[10px] text-neutral-400 uppercase">
                      <span>{file.status}</span>
                      <span>{file.progress}%</span>
                    </div>
                    <div class="w-full bg-neutral-950 border border-neutral-800 h-1.5">
                      <div class="bg-white h-full transition-all duration-200" style="width: {file.progress}%"></div>
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Disconnect Action -->
        <button 
          onclick={disconnect}
          class="w-full bg-neutral-950 text-neutral-400 border border-neutral-800 font-mono text-xs uppercase tracking-widest py-2.5 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
        >
          Disconnect
        </button>

      </div>
    {/if}

  </div>

</main>