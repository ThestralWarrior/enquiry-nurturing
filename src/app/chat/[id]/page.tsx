import { notFound } from "next/navigation";
import { getLead } from "@/lib/store";
import ChatClient from "@/components/ChatClient";

export const dynamic = "force-dynamic";

export default async function ChatPage({
  params,
}: {
  params: { id: string };
}) {
  const lead = await getLead(params.id);
  if (!lead) notFound();
  return <ChatClient lead={lead} />;
}
