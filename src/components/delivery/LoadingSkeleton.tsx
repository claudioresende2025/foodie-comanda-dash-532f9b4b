import { memo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header Skeleton */}
      <header className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-12 h-12 rounded-2xl bg-white/20" />
            <div>
              <Skeleton className="h-5 w-32 bg-white/20 mb-1" />
              <Skeleton className="h-3 w-16 bg-white/20" />
            </div>
          </div>
          <Skeleton className="h-12 w-full rounded-xl bg-white/20" />
        </div>
      </header>

      {/* Content Skeleton */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-0 shadow-md">
              <CardContent className="p-0">
                <Skeleton className="aspect-[16/10] w-full" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
});
