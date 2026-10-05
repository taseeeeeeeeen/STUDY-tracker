import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { BoardCard, DayColumnData } from '../../types/wizard';
import { DraggableTopicCard } from './DraggableTopicCard';

interface DroppableDayColumnProps {
  column: DayColumnData;
  cards: BoardCard[];
  currentDay: number;
  activeCard: BoardCard | null;
  onCardClick: (card: BoardCard) => void;
  isBoardLocked?: boolean;
  onRemoveTopic?: (topicId: string, topicTitle?: string) => void;
  onRemoveCard?: (card: BoardCard) => void;
}

export const DroppableDayColumn: React.FC<DroppableDayColumnProps> = ({
  column,
  cards,
  currentDay,
  activeCard: _activeCard,
  onCardClick,
  isBoardLocked = false,
  onRemoveTopic,
  onRemoveCard,
}) => {
  const isPast = column.dayNumber < currentDay;
  const isToday = column.dayNumber === currentDay;

  const { isOver, setNodeRef } = useDroppable({
    id: `column-${column.dayNumber}`,
    disabled: isBoardLocked,
    data: {
      column,
      dayNumber: column.dayNumber,
      isPast,
    },
  });

  // Calculate total workload for this day across all chapter cards
  const totalMinutes = cards.reduce((sum, c) => sum + c.durationMinutes, 0);
  const totalChapters = cards.length;
  const totalTopics = cards.reduce((sum, c) => sum + (c.topics?.length || 1), 0);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeFormatted = `${hours > 0 ? `${hours}h ` : ''}${mins}m`;
  const capacityPercent = Math.min(100, Math.round((totalMinutes / column.capacityMinutes) * 100));

  return (
    <div className="flex-1 flex flex-col gap-2 min-w-[210px] max-w-[240px]">
      {/* Column Header Card */}
      <div
        className={`p-3.5 rounded-xl border shadow-xs flex flex-col gap-1.5 transition-all ${
          isToday
            ? 'bg-white border-[#003820] ring-2 ring-[#003820]/20'
            : isPast
            ? 'bg-[#eff4ff]/80 border-amber-300/70'
            : 'bg-white border-[#c0c9c0]/40'
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`font-bold text-xs truncate ${
              isToday ? 'text-[#003820]' : isPast ? 'text-[#404942]' : 'text-[#0b1c30]'
            }`}
          >
            {column.dateLabel}
          </span>
          <div className="flex items-center gap-1">
            {isPast ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                PAST
              </span>
            ) : isToday ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#003820] text-white">
                TODAY
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-[#e5eeff] text-[#003820] text-[10px] font-bold">
                {column.dayName}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-[#404942] text-[11px] font-mono">
          <span>
            {totalChapters} {totalChapters === 1 ? 'ch' : 'chs'} ({totalTopics} {totalTopics === 1 ? 'topic' : 'topics'})
          </span>
          <span>{timeFormatted}</span>
        </div>

        {/* Capacity Bar */}
        <div className="w-full h-1.5 rounded-full bg-[#e5eeff] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isPast
                ? 'bg-[#707971]'
                : capacityPercent > 90
                ? 'bg-[#ba1a1a]'
                : 'bg-[#003820]'
            }`}
            style={{ width: `${capacityPercent}%` }}
          />
        </div>
      </div>

      {/* Droppable Column Area */}
      <div
        ref={setNodeRef}
        className={`rounded-2xl p-2.5 min-h-[380px] flex flex-col gap-2.5 border-2 transition-all ${
          isOver && isPast
            ? 'border-[#ba1a1a] bg-[#ffdad6]/40 ring-4 ring-[#ba1a1a]/20'
            : isOver && !isPast
            ? 'border-blue-600 bg-blue-50/80 ring-4 ring-blue-500/20'
            : isPast
            ? 'bg-[#eff4ff]/60 border-dashed border-[#c0c9c0]/50'
            : 'bg-[#eff4ff]/70 border-transparent hover:border-[#c0c9c0]/30'
        }`}
      >
        {/* Past column lock warning indicator */}
        {isPast && (
          <div className="px-2.5 py-1.5 rounded-lg bg-amber-100/70 border border-amber-300/80 text-amber-900 text-[10px] font-medium flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs text-amber-700">lock</span>
            <span>Past Day (Inbound drops locked)</span>
          </div>
        )}

        {/* Render Cards */}
        {cards.map((card) => (
          <DraggableTopicCard
            key={card.id}
            card={card}
            isPastColumn={isPast}
            onCardClick={onCardClick}
            isBoardLocked={isBoardLocked}
            onRemoveTopic={onRemoveTopic}
            onRemoveCard={onRemoveCard}
          />
        ))}

        {/* Dynamic Drop Hover Placeholders */}
        {isOver && isPast && (
          <div className="p-3 rounded-xl border border-[#ba1a1a] bg-[#ffdad6] text-[#93000a] text-center text-xs font-semibold flex flex-col items-center gap-1 animate-pulse">
            <span className="material-symbols-outlined text-base">block</span>
            <span>Day is Locked</span>
            <span className="text-[10px] font-normal">Cannot schedule chapters for past days</span>
          </div>
        )}

        {isOver && !isPast && (
          <div className="p-3 rounded-xl border border-blue-500 bg-blue-100 text-blue-700 text-center text-xs font-semibold flex items-center justify-center gap-1.5 animate-pulse">
            <span className="material-symbols-outlined text-base animate-bounce">
              arrow_downward
            </span>
            <span>Drop chapter here</span>
          </div>
        )}

        {/* Empty state hint */}
        {cards.length === 0 && !isOver && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4 border border-dashed border-[#c0c9c0]/60 rounded-xl text-[#707971]">
            <span className="material-symbols-outlined text-2xl text-[#c0c9c0] mb-1">
              {isPast ? 'history' : 'add_circle_outline'}
            </span>
            <span className="text-[11px] font-medium">
              {isPast ? 'No past chapters' : 'Drag chapter here'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
