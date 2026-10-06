<script lang="ts">
    // TODO: Get session info from server
    let sessionId = $state("0123456");
    let sessionPwd = $state("asdfghi");
</script>

<main class="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center p-4">
  
  <h1 class="text-3xl font-mono tracking-widest uppercase mb-6 text-white">
    FileTransfer
  </h1>

  <div class="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-none p-6 shadow-2xl space-y-6">
    
    <!-- User -->
    <div class="user flex justify-center">
      <div class="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-700 flex items-center justify-center ring-1 ring-neutral-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-10 h-10 text-neutral-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    </div>

    <!-- Session Info -->
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
  </div>

  <!-- Button Container  -->
  <div class="w-full max-w-sm mt-5 flex items-center justify-center gap-10">
    <button class="bg-neutral-900 border border-neutral-800 rounded-none px-4 py-2 text-xs font-mono uppercase tracking-wider shadow-2xl hover:bg-neutral-800" >
        Host
    </button>
    <button class="bg-neutral-900 border border-neutral-800 rounded-none px-4 py-2 text-xs font-mono uppercase tracking-wider shadow-2xl hover:bg-neutral-800" >
        Connect
    </button>
  </div>

</main>