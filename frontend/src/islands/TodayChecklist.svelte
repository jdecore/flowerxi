<script>
  import { onDestroy, onMount } from 'svelte';

  export let initialRegion = 'madrid';

  const regionNames = {
    madrid: 'Madrid',
    facatativa: 'Facatativá',
    funza: 'Funza',
  };

  const checklistTemplate = [
    { id: 'recorrido-manana', label: 'Recorrido matutino (7:00 AM)' },
    { id: 'verificar-drenaje', label: 'Verificar drenaje' },
    { id: 'revisar-puntos-humedos', label: 'Revisar puntos húmedos' },
    { id: 'registro-fitosanitario', label: 'Registrar observaciones fitosanitarias' },
  ];

  let region = initialRegion;
  let tasks = [];
  let modalOpen = false;
  let humidAction = '';
  let photoInput;

  const todayKey = () => new Date().toISOString().slice(0, 10);
  const storageKey = () => `flowerxi_checklist:${region}:${todayKey()}`;

  const saveState = () => {
    if (typeof window === 'undefined') return;
    const payload = {
      tasks: tasks.map((task) => ({ id: task.id, checked: task.checked })),
      humidAction,
    };
    window.localStorage.setItem(storageKey(), JSON.stringify(payload));
  };

  const loadState = () => {
    tasks = checklistTemplate.map((task) => ({ ...task, checked: false }));
    humidAction = '';

    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(storageKey());
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const checkedById = new Map((parsed?.tasks ?? []).map((item) => [item.id, Boolean(item.checked)]));
      tasks = checklistTemplate.map((task) => ({
        ...task,
        checked: checkedById.get(task.id) ?? false,
      }));
      humidAction = parsed?.humidAction ?? '';
    } catch {
      // no-op
    }
  };

  const toggleTask = (taskId) => {
    tasks = tasks.map((task) =>
      task.id === taskId ? { ...task, checked: !task.checked } : task
    );

    const humidTask = tasks.find((task) => task.id === 'revisar-puntos-humedos');
    if (taskId === 'revisar-puntos-humedos' && humidTask?.checked) {
      modalOpen = true;
    }

    if (taskId === 'revisar-puntos-humedos' && !humidTask?.checked) {
      humidAction = '';
    }

    saveState();
  };

  const selectNoNovelty = () => {
    humidAction = 'sin_novedad';
    modalOpen = false;
    saveState();
  };

  const takePhoto = () => {
    if (photoInput) {
      photoInput.click();
    }
  };

  const onPhotoSelected = (event) => {
    const files = event?.target?.files;
    if (files && files.length > 0) {
      humidAction = 'foto';
      modalOpen = false;
      saveState();
    }
  };

  const onRegionChange = (event) => {
    if (!event?.detail || event.detail === region) return;
    region = event.detail;
    loadState();
  };

  onMount(() => {
    loadState();
    if (typeof window !== 'undefined') {
      window.addEventListener('regionchange', onRegionChange);
    }
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('regionchange', onRegionChange);
    }
  });

  $: completedCount = tasks.filter((task) => task.checked).length;
  $: regionLabel = regionNames[region] ?? region;
</script>

<div class="checklist-wrap">
  <p class="subtitle">Checklist operativo — {regionLabel}</p>
  <p class="counter">{completedCount}/{tasks.length} tareas completadas hoy</p>

  <div class="checklist">
    {#each tasks as task}
      <label class="check-item {task.checked ? 'checked' : ''}">
        <input type="checkbox" checked={task.checked} on:change={() => toggleTask(task.id)} />
        <span>{task.label}</span>
      </label>
    {/each}
  </div>

  {#if humidAction}
    <p class="micro-status">
      {#if humidAction === 'foto'}
        Punto húmedo: evidencia con foto registrada.
      {:else}
        Punto húmedo: marcado como “Sin novedad”.
      {/if}
    </p>
  {/if}
</div>

<input
  bind:this={photoInput}
  type="file"
  accept="image/*"
  capture="environment"
  class="hidden-file"
  on:change={onPhotoSelected}
/>

{#if modalOpen}
  <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="Registro de punto húmedo">
    <div class="modal">
      <h3>Revisar puntos húmedos</h3>
      <p>Registra el resultado de esta inspección para dejar trazabilidad del turno.</p>
      <div class="modal-actions">
        <button type="button" class="primary" on:click={takePhoto}>Tomar foto</button>
        <button type="button" class="secondary" on:click={selectNoNovelty}>Sin novedad</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .subtitle {
    margin: 0;
    font-size: 0.83rem;
    color: var(--text-secondary, #64748b);
  }

  .counter {
    margin: 0.25rem 0 0.8rem;
    font-size: 0.82rem;
    color: var(--primary, #7b5ba6);
    font-weight: 600;
  }

  .checklist {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .check-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem;
    background: var(--bg-app, #f8fafc);
    border-radius: 10px;
    border: 1px solid var(--border-subtle, #e2e8f0);
    font-size: 0.9rem;
  }

  .check-item.checked {
    border-color: var(--status-rutina, #10b981);
  }

  .check-item input {
    width: 18px;
    height: 18px;
  }

  .micro-status {
    margin: 0.9rem 0 0;
    font-size: 0.8rem;
    color: var(--text-secondary, #4b5563);
    background: var(--status-vigilancia-bg, #fef3c7);
    border-left: 3px solid var(--status-vigilancia, #f59e0b);
    border-radius: 8px;
    padding: 0.55rem 0.7rem;
  }

  .hidden-file {
    display: none;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(12, 10, 18, 0.42);
    display: grid;
    place-items: center;
    z-index: 90;
    padding: 1rem;
  }

  .modal {
    width: min(420px, 100%);
    background: var(--bg-surface, #fff);
    border-radius: 14px;
    border: 1px solid var(--border-subtle, #e2e8f0);
    padding: 1rem;
  }

  .modal h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--text-primary, #1f2937);
  }

  .modal p {
    margin: 0.5rem 0 0;
    font-size: 0.86rem;
    line-height: 1.4;
    color: var(--text-secondary, #4b5563);
  }

  .modal-actions {
    margin-top: 0.9rem;
    display: flex;
    gap: 0.6rem;
  }

  .modal-actions button {
    border: none;
    border-radius: 10px;
    padding: 0.55rem 0.75rem;
    font: inherit;
    font-size: 0.86rem;
    cursor: pointer;
  }

  .modal-actions .primary {
    background: var(--primary, #7b5ba6);
    color: #fff;
  }

  .modal-actions .secondary {
    background: var(--bg-app, #f8fafc);
    color: var(--text-primary, #1f2937);
    border: 1px solid var(--border-subtle, #e2e8f0);
  }
</style>
