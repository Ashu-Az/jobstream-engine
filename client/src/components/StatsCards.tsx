'use client';

import { StatsResponse } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Download,
  PlusCircle,
  RefreshCw,
  XCircle,
  Zap,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  stats: StatsResponse['data'] | null;
}

export default function StatsCards({ stats }: Props) {
  if (!stats) return null;

  const { aggregate, queue } = stats;

  const cards = [
    {
      title: 'Total Imported',
      value: aggregate?.totalImported || 0,
      icon: Download,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      darkBgColor: 'dark:bg-blue-950',
    },
    {
      title: 'New Jobs',
      value: aggregate?.totalNew || 0,
      icon: PlusCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      darkBgColor: 'dark:bg-green-950',
    },
    {
      title: 'Updated Jobs',
      value: aggregate?.totalUpdated || 0,
      icon: RefreshCw,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      darkBgColor: 'dark:bg-amber-950',
    },
    {
      title: 'Failed Jobs',
      value: aggregate?.totalFailed || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      darkBgColor: 'dark:bg-red-950',
    },
    {
      title: 'Active Jobs',
      value: queue?.active || 0,
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      darkBgColor: 'dark:bg-purple-950',
    },
    {
      title: 'Waiting Jobs',
      value: queue?.waiting || 0,
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      darkBgColor: 'dark:bg-indigo-950',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div
                className={cn(
                  'rounded-full p-2',
                  card.bgColor,
                  card.darkBgColor
                )}
              >
                <Icon className={cn('h-4 w-4', card.color)} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {card.value.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total count
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
