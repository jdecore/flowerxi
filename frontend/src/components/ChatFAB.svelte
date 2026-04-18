<script>
  let chatOpen = false;

  const toggleChat = () => {
    chatOpen = !chatOpen;
    window.dispatchEvent(new CustomEvent('flowerxi-chat-toggle', { detail: { open: chatOpen } }));
    if (chatOpen) {
      window.dispatchEvent(new Event('openchat'));
    }
  };
</script>

<button class="chat-fab" on:click={toggleChat} aria-label="Chat IA">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
  </svg>
</button>

<style>
  .chat-fab {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    width: 56px;
    height: 56px;
    border: none;
    border-radius: 50%;
    background: var(--primary, #7B5BA6);
    color: white;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(117, 106, 133, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
    z-index: 1000;
  }

  .chat-fab:hover {
    transform: scale(1.06);
    background: var(--primary-hover, #5F546E);
    box-shadow: 0 6px 20px rgba(117, 106, 133, 0.45);
  }

  .chat-fab:active {
    transform: scale(0.98);
  }

  .chat-fab svg {
    width: 26px;
    height: 26px;
  }

  @media (max-width: 700px) {
    .chat-fab {
      right: 1rem;
      bottom: 1rem;
      width: 52px;
      height: 52px;
    }
    .chat-fab svg {
      width: 24px;
      height: 24px;
    }
  }
</style>
