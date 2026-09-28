export default function ActivePolicies() {
  const policies = [
    { label: 'Budget / hour', value: '$5.00', color: 'text-[#00d4ff]' },
    { label: 'Tokens / minute', value: '5,000', color: 'text-[#00d4ff]' },
    { label: 'Calls / minute', value: '60', color: 'text-[#00d4ff]' },
    { label: 'Tool calls / minute', value: '20', color: 'text-[#00d4ff]' },
    { label: 'Blocklisted tools', value: '8', color: 'text-[#ff4d6a]' },
    { label: 'PII patterns', value: '5', color: 'text-[#ffb547]' },
  ];

  return (
    <div className="bg-[#1a1d27] border border-[#2a2d3e] rounded-[10px] p-5 wz-card-shadow">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 mb-2.5 border-b border-[#2a2d3e]">
        <h3 className="text-[11px] font-bold tracking-wider text-[#4a5070] uppercase font-sans">
          ACTIVE POLICIES
        </h3>
        <span className="text-[10px] font-mono text-[#00e5a0] bg-[#00e5a0]/10 px-2 py-0.5 rounded-[4px] border border-[#00e5a0]/25">
          ENFORCED
        </span>
      </div>

      {/* Compact table with alternating rows */}
      <div className="space-y-1">
        {policies.map((p, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-[8px_12px] rounded-[6px] transition-colors ${
              idx % 2 === 1 ? 'bg-[#212435]/50' : 'bg-transparent'
            }`}
          >
            {/* Policy name left in secondary text 12px */}
            <span className="text-[12px] font-sans text-[#8b92a8]">
              {p.label}
            </span>

            {/* Value right in accent color 12px JetBrains Mono bold */}
            <span className={`text-[12px] font-mono font-bold ${p.color}`}>
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
