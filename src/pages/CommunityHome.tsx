import Footer from "@/components/Footer";
import CommunitySection from "@/components/community/CommunitySection";

export default function CommunityHome() {
  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-6xl">
        <CommunitySection />

        <div className="mt-10">
          <Footer />
        </div>
      </main>
    </div>
  );
}
