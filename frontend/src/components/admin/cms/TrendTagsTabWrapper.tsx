import { TrendTagsTab } from "./TrendTagsTab";
import { lazy, Suspense } from "react";

const TrendingProductsManager = lazy(() => import("./TrendingProductsManager"));

function TrendTagsTabWrapper() {
  return (
    <div className="space-y-8">
      <TrendTagsTab />
      <div className="border-t border-border pt-6">
        <Suspense fallback={<div className="flex justify-center py-4"><div className="animate-spin text-primary w-5 h-5 border-2 border-primary border-t-transparent rounded-full" /></div>}>
          <TrendingProductsManager />
        </Suspense>
      </div>
    </div>
  );
}

export default TrendTagsTabWrapper;
