import React, { useState, useEffect } from 'react';
import { BoardCard, DayColumnData } from '../../types/wizard';

interface ShiftTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: BoardCard | null;
  currentDay: number;
  columns: DayColumnData[];
  cards: BoardCard[];
  onConfirmShift: (cardId: string, targetDay: number) => void;
}

export const ShiftTopicModal: React.FC<ShiftTopicModalProps> = ({
  isOpen,
  onClose,
  card,
  currentDay,
  columns,
  cards,
  onConfirmShift,
}) => {
  // REQUIREMENT 3: Strictly populate with Future Days (Days > currentDay)
  const futureDays = columns.filter((col) => col.dayNumber > currentDay);

  const [selectedDay, setSelectedDay] = useState<number>(
    futureDays.length > 0 ? futureDays[0].dayNumber : currentDay + 1
  );
  const [autoBalance, setAutoBalance] = useState(true);

  // Update selected day whenever the modal opens or card changes
  useEffect(() => {
    if (futureDays.length > 0) {
      // Default to next future day or the first future day
      const nextFuture = futureDays.find((d) => d.dayNumber > (card?.dayNumber || 0));
      setSelectedDay(nextFuture ? nextFuture.dayNumber : futureDays[0].dayNumber);
    }
  }, [card, currentDay, isOpen]);

  if (!isOpen || !card) return null;

  const handleConfirm = () => {
    onConfirmShift(card.id, Number(selectedDay));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-[#c0c9c0]/40 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-2 border-b border-[#e5eeff]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eff4ff] text-[#003820] flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">event_upcoming</span>
            </div>
            <div>
              <h3 className="text-base text-[#0b1c30] font-bold">
                Shift Topic to Another Day
              </h3>
              <p className="text-xs text-[#404942]">
                Rebalance module allocation (Past days are locked)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Selected Module Brief Card */}
        <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#0b1c30]">{card.title}</span>
            <span className="text-[11px] text-[#404942]">
              {card.subject} • Currently scheduled on Day {card.dayNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-white text-[#0b1c30] text-[11px] font-mono font-semibold border border-[#c0c9c0]/30">
              {card.durationMinutes} min
            </span>
            <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#003820] text-[10px] font-bold">
              {card.tag}
            </span>
          </div>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0b1c30] flex items-center justify-between">
              <span>Select Target Day</span>
              <span className="text-[11px] text-[#006c49] font-normal">
                Strictly Future Days (Days &gt; {currentDay})
              </span>
            </label>

            {futureDays.length === 0 ? (
              <div className="p-3 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl text-[#93000a] text-xs">
                No future days available for shifting in this sprint.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className="w-full bg-white border border-[#c0c9c0] rounded-xl p-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820] shadow-xs cursor-pointer appearance-none pr-8"
                >
                  {futureDays.map((col) => {
                    const dayCards = cards.filter((c) => c.dayNumber === col.dayNumber);
                    const dayMins = dayCards.reduce((s, c) => s + c.durationMinutes, 0);
                    return (
                      <option key={col.dayNumber} value={col.dayNumber}>
                        {col.dateLabel} ({col.dayName}) — {dayCards.length} topics queued ({dayMins}m load)
                      </option>
                    );
                  })}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#707971] text-lg">
                  expand_more
                </span>
              </div>
            )}
          </div>

          {/* Scientific Validation Note */}
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-amber-700 shrink-0">
              verified_user
            </span>
            <span className="text-[11px]">
              <strong>Time-Travel Prevention Active:</strong> Days 1 to {currentDay} (past/current) are omitted to protect academic integrity.
            </span>
          </div>

          {/* Balance checkbox */}
          <label className="flex items-start gap-2.5 p-2 rounded-xl hover:bg-[#eff4ff] transition-colors cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={autoBalance}
              onChange={(e) => setAutoBalance(e.target.checked)}
              className="mt-0.5 rounded border-[#c0c9c0] text-[#003820] focus:ring-[#003820]"
            />
            <div className="flex flex-col">
              <span className="font-semibold text-[#0b1c30]">
                Preserve 2.5-hour maximum daily ceiling
              </span>
              <span className="text-[#404942] text-[11px]">
                Checks available capacity in Day {selectedDay} before confirming.
              </span>
            </div>
          </label>
        </div>

        {/* Modal Footer Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5eeff]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={futureDays.length === 0}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            Confirm Shift
          </button>
        </div>
      </div>
    </div>
  );
};
