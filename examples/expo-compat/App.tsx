import { NlmDrugsClient } from "@knorby/nlm-drugs-client";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function App() {
  const [status, setStatus] = useState("Searching…");

  useEffect(() => {
    const controller = new AbortController();
    const client = new NlmDrugsClient();
    Promise.all([
      client.rxNorm.findConcepts("aspirin", { signal: controller.signal }),
      client.medlinePlus.searchTopics("aspirin", { signal: controller.signal }),
    ])
      .then(([rxcuis, page]) => {
        setStatus(
          `${rxcuis[0] ?? "No RxCUI"} · ${page.results[0]?.title ?? "No topic"}`,
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setStatus(String(error));
      });
    return () => controller.abort();
  }, []);

  return (
    <View>
      <Text>{status}</Text>
    </View>
  );
}
