import { RobotKiosk } from "@/views/kiosk/RobotKiosk";
import { env } from "@/models/env";

export default function Home() {
  return (
    <RobotKiosk
      publicKey={env.NEXT_PUBLIC_VAPI_PUBLIC_KEY}
      assistantId={env.NEXT_PUBLIC_VAPI_ASSISTANT_ID}
    />
  );
}
