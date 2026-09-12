import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { AuditEvent, MinuteActivityBucket } from '../types';

interface ActivityChartProps {
  events: AuditEvent[];
}

export default function ActivityChart({ events }: ActivityChartProps) {
  const chartData = useMemo(() => {
    // Generate buckets for the last 15 minutes up to now
    const now = new Date();
    const bucketsMap = new Map<string, MinuteActivityBucket>();

    for (let i = 14; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 60 * 1000);
      const timeLabel = d.toTimeString().slice(0, 5); // HH:MM
      bucketsMap.set(timeLabel, {
        time: timeLabel,
        allow: 0,
        redact: 0,
        block: 0,
        total: 0,
      });
    }

    // Populate with actual events
    for (const ev of events) {
      try {
        const d = new Date(ev.timestamp);
        const timeLabel = d.toTimeString().slice(0, 5);
        if (bucketsMap.has(timeLabel)) {
          const bucket = bucketsMap.get(timeLabel)!;
          if (ev.decision === 'ALLOW') bucket.allow += 1;
          else if (ev.decision === 'REDACT') bucket.redact += 1;
          else if (ev.decision === 'BLOCK') bucket.block += 1;
          bucket.total += 1;
        }
      } catch {
        // Skip invalid date
      }
    }

    return Array.from(bucketsMap.values());
  }, [events]);

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-6 wz-card-shadow flex flex-col">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        {/* "INTERCEPTION ACTIVITY" in 11px caps muted Inter on the left */}
        <div className="flex items-center gap-4">
          <h2 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
            INTERCEPTION ACTIVITY
          </h2>

          {/* Clean inline legend */}
          <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00e5a0]" />
              <span className="text-[#8b92a8]">Allow</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ffb547]" />
              <span className="text-[#8b92a8]">Redact</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#ff4d6a]" />
              <span className="text-[#8b92a8]">Block</span>
            </div>
          </div>
        </div>

        {/* LIVE badge on the right — pill shape, red background rgba(255,77,106,0.15), red border, red pulsing dot, "LIVE" text in red 10px caps */}
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[rgba(255,77,106,0.15)] border border-[#ff4d6a]/40">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff4d6a] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ff4d6a]" />
          </span>
          <span className="text-[10px] font-bold tracking-wider text-[#ff4d6a] uppercase font-sans">
            LIVE
          </span>
        </div>
      </div>

      {/* Chart container: clean stacked area chart */}
      <div className="h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          >
            <defs>
              {/* Green #00e5a0: 30% opacity at top to 0% at bottom */}
              <linearGradient id="colorAllow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00e5a0" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00e5a0" stopOpacity={0.0} />
              </linearGradient>
              {/* Amber #ffb547: 30% opacity at top to 0% at bottom */}
              <linearGradient id="colorRedact" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffb547" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ffb547" stopOpacity={0.0} />
              </linearGradient>
              {/* Red #ff4d6a: 30% opacity at top to 0% at bottom */}
              <linearGradient id="colorBlock" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff4d6a" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ff4d6a" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            {/* Remove all grid lines except subtle horizontal lines in #2a2d3e */}
            <CartesianGrid
              stroke="#2a2d3e"
              strokeDasharray="3 3"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              stroke="#4a5070"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#2a2d3e' }}
              fontFamily="JetBrains Mono, monospace"
            />
            <YAxis
              stroke="#4a5070"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: '#2a2d3e' }}
              fontFamily="JetBrains Mono, monospace"
              allowDecimals={false}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                return (
                  <div className="bg-[#0f1117] border border-[#2a2d3e] rounded-[6px] p-2.5 text-xs font-mono shadow-xl">
                    <div className="text-[#8b92a8] font-semibold mb-1.5 border-b border-[#2a2d3e] pb-1">
                      Time: {label}
                    </div>
                    <div className="text-[#00e5a0] flex justify-between gap-4 py-0.5">
                      <span>Allow:</span>
                      <span className="font-bold">{payload[0]?.value || 0}</span>
                    </div>
                    <div className="text-[#ffb547] flex justify-between gap-4 py-0.5">
                      <span>Redact:</span>
                      <span className="font-bold">{payload[1]?.value || 0}</span>
                    </div>
                    <div className="text-[#ff4d6a] flex justify-between gap-4 py-0.5">
                      <span>Block:</span>
                      <span className="font-bold">{payload[2]?.value || 0}</span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Stacked Areas with 1.5px solid stroke */}
            <Area
              type="monotone"
              dataKey="allow"
              stackId="1"
              stroke="#00e5a0"
              strokeWidth={1.5}
              fill="url(#colorAllow)"
            />
            <Area
              type="monotone"
              dataKey="redact"
              stackId="1"
              stroke="#ffb547"
              strokeWidth={1.5}
              fill="url(#colorRedact)"
            />
            <Area
              type="monotone"
              dataKey="block"
              stackId="1"
              stroke="#ff4d6a"
              strokeWidth={1.5}
              fill="url(#colorBlock)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
