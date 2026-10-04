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
  // Allow shifting to ANY active day >= currentDay, excluding the chapter's current day
  const selectableDays = columns.filter(
    (col) => col.dayNumber >= currentDay && col.dayNumber !== card?.dayNumber
  );

  const [selectedDay, setSelectedDay] = useState<number>(
    selectableDays.length > 0 ? selectableDays[0].dayNumber : currentDay
  );
  const [autoBalance, setAutoBalance] = useState(true);
  const [overrideCapacity, setOverrideCapacity] = useState(false);

  // Calculate target day capacity and projected workload
  const targetCards = cards.filter((c) => c.dayNumber === selectedDay && c.id !== card?.id);
  const targetCurrentMins = targetCards.reduce((sum, c) => sum + c.durationMinutes, 0);
  const targetCol = columns.find((c) => c.dayNumber === selectedDay);
  const targetCapacity = targetCol?.capacityMinutes || 150;
  const projectedTotal = targetCurrentMins + (card?.durationMinutes || 0);
  const isOverCapacity = projectedTotal > targetCapacity;

  // Reset override whenever target day changes
  useEffect(() => {
    setOverrideCapacity(false);
  }, [selectedDay]);

  // Update selected day whenever the modal opens or card changes
  useEffect(() => {
    if (selectableDays.length > 0) {
      // If card is on a future day, default to today or next
      const defaultDay =
        card && card.dayNumber > currentDay
          ? currentDay
          : selectableDays.find((d) => d.dayNumber > (card?.dayNumber || 0))?.dayNumber ||
            selectableDays[0].dayNumber;
      setSelectedDay(defaultDay);
    }
  }, [card, currentDay, isOpen]);

  if (!isOpen || !card) return null;

  const handleConfirm = () => {
    onConfirmShift(card.id, Number(selectedDay));
    onClose();
  };

  const topicCount = card.topics?.length || 1;

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
                Shift Chapter to Another Day
              </h3>
              <p className="text-xs text-[#404942]">
                Move all {topicCount} topics of this chapter in one action
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#707971] hover:text-[#0b1c30] hover:bg-[#eff4ff] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Selected Chapter Brief Card */}
        <div className="p-3.5 rounded-xl bg-[#eff4ff] border border-[#c0c9c0]/30 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-[#0b1c30]">
              {card.chapterName || card.title}
            </span>
            <span className="text-[11px] text-[#404942]">
              {card.subject} • {topicCount} {topicCount === 1 ? 'topic' : 'topics'} • Scheduled on Day {card.dayNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-white text-[#0b1c30] text-[11px] font-mono font-semibold border border-[#c0c9c0]/30">
              {card.durationMinutes} min
            </span>
            <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#003820] text-[10px] font-bold">
              Chapter
            </span>
          </div>
        </div>

        {/* Form Controls */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#0b1c30] flex items-center justify-between">
              <span>Select Destination Day</span>
              <span className="text-[11px] text-[#006c49] font-normal">
                Active Days (Today &amp; Upcoming)
              </span>
            </label>

            {selectableDays.length === 0 ? (
              <div className="p-3 bg-[#ffdad6]/60 border border-[#ba1a1a]/30 rounded-xl text-[#93000a] text-xs">
                No alternative days available for shifting in this sprint.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className="w-full bg-white border border-[#c0c9c0] rounded-xl p-3 text-xs text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#003820] shadow-xs cursor-pointer appearance-none pr-8"
                >
                  {selectableDays.map((col) => {
                    const isTodayCol = col.dayNumber === currentDay;
                    const dayCards = cards.filter((c) => c.dayNumber === col.dayNumber);
                    const dayMins = dayCards.reduce((s, c) => s + c.durationMinutes, 0);
                    const dayTopics = dayCards.reduce((s, c) => s + (c.topics?.length || 1), 0);
                    return (
                      <option key={col.dayNumber} value={col.dayNumber}>
                        {col.dateLabel} ({col.dayName}){isTodayCol ? ' — TODAY' : ''} — {dayCards.length} chs, {dayTopics} topics ({dayMins}m load)
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

          {/* Capacity Exceeded Warning */}
          {isOverCapacity && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-base text-amber-700 shrink-0">
                  warning
                </span>
                <div className="space-y-0.5">
                  <span className="font-bold text-amber-900">
                    Daily Capacity Warning
                  </span>
                  <p className="text-[11px] text-amber-800">
                    Day {selectedDay} already has {targetCurrentMins} min; adding this chapter makes {projectedTotal} min (target limit: {targetCapacity} min).
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 p-2 rounded-lg bg-amber-100/70 border border-amber-300/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overrideCapacity}
                  onChange={(e) => setOverrideCapacity(e.target.checked)}
                  className="rounded border-amber-400 text-[#003820] focus:ring-[#003820]"
                />
                <span className="font-semibold text-[11px] text-amber-950">
                  I understand this exceeds capacity; override deliberately
                </span>
              </label>
            </div>
          )}

          {/* Validation Note */}
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <span className="material-symbols-outlined text-base text-amber-700 shrink-0">
              verified_user
            </span>
            <span className="text-[11px]">
              <strong>Academic Integrity Rules:</strong> You can shift chapters freely between Today and future days until midnight. Past days are locked to maintain reliable records.
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
                Preserve daily workload balance
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
            className="px-4 py-2 rounded-xl text-[#404942] hover:bg-[#eff4ff] text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectableDays.length === 0 || (isOverCapacity && !overrideCapacity)}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-[#003820] hover:bg-[#0f5132] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">check</span>
            {isOverCapacity ? 'Override & Confirm Shift' : 'Confirm Shift'}
          </button>
        </div>
      </div>
    </div>
  );
};
