import { useMemo } from "react";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";
import ReputationBar from "@/components/reputation/ReputationBar";

export default function PrintReputationSummary({ userId }: { userId: string }) {
  const { data } = useUserPrintReputation(userId);

  const metrics = useMemo(() => {
    const submitted = data?.customer_requests_made ?? 0;
    const received = data?.customer_requests_received ?? 0;
    const receiveRate = data?.customer_receive_rate_percent ?? (submitted > 0 ? (received / submitted) * 100 : null);

    const accepted = data?.merchant_accepted_jobs ?? 0;
    const completed = data?.merchant_completed_jobs ?? 0;
    const completion = data?.merchant_completion_percent ?? (accepted > 0 ? (completed / accepted) * 100 : null);

    return [
      {
        key: "customer_receive",
        label: "نسبة استلام العميل",
        percent: receiveRate == null ? null : Number(receiveRate),
        hint: "نسبة الطلبات التي استلمها العميل من مجموع ما قدّمه.",
        rightText: submitted ? `${received} من ${submitted}` : "—",
      },
      {
        key: "merchant_completion",
        label: "نسبة إكمال التاجر",
        percent: completion == null ? null : Number(completion),
        hint: "نسبة الأعمال المكتملة من الأعمال المقبولة للتاجر.",
        rightText: accepted ? `${completed} من ${accepted}` : "—",
      },
    ];
  }, [data]);

  return (
    <ReputationBar
      overallStars={data?.avg_stars ?? null}
      basisCount={data?.ratings_count ?? null}
      basisLabel="تقييم"
      metrics={metrics}
    />
  );
}
