import type { ModelInfo, ModelSettings } from '../../types';
import { Button } from '../ui/Button';
import { Field, Slider, Switch, TextArea } from '../ui/Field';
import { ModelSelector } from './ModelSelector';
import { Section } from './Section';

export interface GenerationSectionProps {
  models: readonly ModelInfo[];
  model: string;
  usingFallback: boolean;
  defaults: ModelSettings;
  activeConversationId: string | null;
  onModelChange: (modelId: string) => void;
  onDefaultsChange: (patch: Partial<ModelSettings>) => void;
  onApplyToActiveConversation: () => void;
}

export function GenerationSection({
  models,
  model,
  usingFallback,
  defaults,
  activeConversationId,
  onModelChange,
  onDefaultsChange,
  onApplyToActiveConversation,
}: GenerationSectionProps) {
  return (
    <Section
      title="Model and generation"
      description="Defaults apply to conversations you create from now on."
    >
      <Field
        label="Default model"
        htmlFor="default-model"
        hint={
          usingFallback
            ? 'Live model discovery is unavailable, so the bundled list is shown. Sending still works if the id is valid on your endpoint.'
            : `${models.length} models discovered from the endpoint.`
        }
      >
        <ModelSelector id="default-model" models={models} value={model} onChange={onModelChange} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider
          label="Temperature"
          min={0}
          max={2}
          step={0.05}
          value={defaults.temperature}
          formatValue={(value) => value.toFixed(2)}
          onChange={(event) => onDefaultsChange({ temperature: Number(event.target.value) })}
        />
        <Slider
          label="Top P"
          min={0}
          max={1}
          step={0.05}
          value={defaults.topP}
          formatValue={(value) => value.toFixed(2)}
          onChange={(event) => onDefaultsChange({ topP: Number(event.target.value) })}
        />
      </div>

      <Slider
        label="Maximum tokens"
        min={64}
        max={8192}
        step={64}
        value={Math.min(defaults.maxTokens, 8192)}
        formatValue={(value) => value.toLocaleString()}
        onChange={(event) => onDefaultsChange({ maxTokens: Number(event.target.value) })}
      />

      <Switch
        label="Stream responses"
        hint="Show tokens as they are generated. Turn off if your endpoint does not support streaming."
        checked={defaults.stream}
        onChange={(checked) => onDefaultsChange({ stream: checked })}
      />

      <Field
        label="System prompt"
        htmlFor="system-prompt"
        hint="Prepended to every request. Leave empty for the model's default behaviour."
      >
        <TextArea
          id="system-prompt"
          rows={3}
          value={defaults.systemPrompt}
          placeholder="You are a concise senior engineer…"
          onChange={(event) => onDefaultsChange({ systemPrompt: event.target.value })}
        />
      </Field>

      {activeConversationId ? (
        <Button variant="quiet" size="sm" onClick={onApplyToActiveConversation}>
          Apply these settings to the open conversation
        </Button>
      ) : null}
    </Section>
  );
}
