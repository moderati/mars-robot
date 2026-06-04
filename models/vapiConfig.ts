import type Vapi from "@vapi-ai/web";

type VapiAssistantOverrides = NonNullable<Parameters<Vapi["start"]>[1]>;
type VapiStartOptions = NonNullable<Parameters<Vapi["start"]>[5]>;

const ACKNOWLEDGEMENT_PHRASES = [
  "i understand",
  "i see",
  "i got it",
  "i hear you",
  "im listening",
  "im with you",
  "right",
  "okay",
  "ok",
  "sure",
  "alright",
  "got it",
  "understood",
  "yeah",
  "yes",
  "yep",
  "yup",
  "uh-huh",
  "uh huh",
  "mm-hmm",
  "mm hmm",
  "mhm",
  "mhmm",
  "gotcha",
  "ah",
  "cool",
  "nice",
  "wow",
  "yeah okay",
  "yeah sure",
];

const INTERRUPTION_PHRASES = [
  "robot stop",
  "robot please stop",
];

export const VAPI_ASSISTANT_OVERRIDES: VapiAssistantOverrides = {
  // Core assistant pipeline overrides.
  transcriber: undefined,
  model: undefined,
  voice: undefined,

  // Conversation entry behavior.
  firstMessage: undefined,
  firstMessageInterruptionsEnabled: undefined,
  firstMessageMode: undefined,

  // Phone/call behavior. Some options only apply to phone calls, but the Web SDK
  // accepts the same assistant override shape.
  voicemailDetection: undefined,
  voicemailMessage: undefined,
  endCallMessage: undefined,
  endCallPhrases: undefined,
  maxDurationSeconds: undefined,
  backgroundSound: undefined,
  modelOutputInMessagesEnabled: undefined,
  transportConfigurations: undefined,

  // Messages, observability, credentials, hooks, tools, and dynamic variables.
  clientMessages: undefined,
  serverMessages: undefined,
  observabilityPlan: undefined,
  credentials: undefined,
  hooks: undefined,
  "tools:append": undefined,
  variableValues: undefined,
  name: undefined,
  compliancePlan: undefined,
  metadata: undefined,

  // Audio cleanup for the outdoor Philadelphia robot kiosk.
  backgroundSpeechDenoisingPlan: {
    smartDenoisingPlan: {
      enabled: true,
    },
    fourierDenoisingPlan: {
      enabled: true,
      mediaDetectionEnabled: true,
      baselineOffsetDb: -10,
      windowSizeMs: 2000,
      baselinePercentile: 90,
    },
  },

  // Turn-taking: quick responses, but not so quick that short pauses get cut off.
  startSpeakingPlan: {
    waitSeconds: 0.2,
    smartEndpointingPlan: {
      provider: "livekit",
      waitFunction:
        "(20 + 500 * sqrt(x) + 2500 * x^3 + 700 + 4000 * max(0, x-0.5)) / 2",
    },
    customEndpointingRules: undefined,
    transcriptionEndpointingPlan: {
      onPunctuationSeconds: 0.25,
      onNoPunctuationSeconds: 1.6,
      onNumberSeconds: 0.8,
    },
  },

  // Crowd-safe interruption handling for shouting and side conversations.
  stopSpeakingPlan: {
    numWords: 8,
    voiceSeconds: 0.45,
    backoffSeconds: 1,
    acknowledgementPhrases: ACKNOWLEDGEMENT_PHRASES,
    interruptionPhrases: INTERRUPTION_PHRASES,
  },

  // Call analysis, artifacts, monitoring, server, and input plans.
  analysisPlan: undefined,
  artifactPlan: undefined,
  monitorPlan: undefined,
  credentialIds: undefined,
  server: undefined,
  keypadInputPlan: undefined,
};

export const VAPI_START_OPTIONS: VapiStartOptions = {
  roomDeleteOnUserLeaveEnabled: false,
};
