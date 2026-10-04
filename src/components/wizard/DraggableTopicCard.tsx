import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BoardCard } from '../../types/wizard';

interface DraggableTopicCardProps {
  card: BoardCard;
  isPastColumn: boolean;
  onCardClick: (card: BoardCard) => void;
  isBoardLocked?: boolean;
}

export const DraggableTopicCard: React.FC<DraggableTopicCardProps> = ({
  card,
  isPastColumn,
  onCardClick,
  isBoardLocked = false,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: isBoardLocked,
    data: {
      card,
      dayNumber: card.dayNumber,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    touchAction: isBoardLocked ? 'auto' : 'none',
  };

  const getSubjectBadgeStyle = (subject: string) => {
    switch (subject) {
      case 'Physics':
        return 'bg-[#e5eeff] text-[#003820]';
      case 'Chemistry':
        return 'bg-[#e5eeff] text-[#006c49]';
      case 'Calculus III':
        return 'bg-blue-100 text-blue-700';
      case 'Sprint Review':
        return 'bg-[#6ffbbe]/40 text-[#002113]';
      default:
        return 'bg-[#eff4ff] text-[#404942]';
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        // Only trigger click if not actively dragging and board is unlocked
        if (!isDragging && !isBoardLocked) {
          onCardClick(card);
        }
      }}
      className={`bg-white rounded-xl p-3.5 shadow-xs border transition-all select-none group relative ${
        isBoardLocked
          ? 'cursor-default border-[#c0c9c0]/30'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md ' +
            (isPastColumn ? 'border-amber-300/80 bg-amber-50/20' : 'border-[#c0c9c0]/40')
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${getSubjectBadgeStyle(
            card.subject
          )}`}
        >
          {card.subject}
        </span>

        {/* Shift Action Button */}
        <button
          type="button"
          disabled={isBoardLocked}
          onClick={(e) => {
            e.stopPropagation();
            if (!isBoardLocked) {
              onCardClick(card);
            }
          }}
          className={`p-1 rounded-md transition-colors ${
            isBoardLocked
              ? 'text-[#c0c9c0] cursor-not-allowed'
              : 'text-[#707971] hover:text-[#003820] hover:bg-[#eff4ff] cursor-pointer'
          }`}
          title={isBoardLocked ? 'Save challenge first to unlock shifting' : 'Shift topic to another future day'}
        >
          <span className="material-symbols-outlined text-sm leading-none">
            {isBoardLocked ? 'lock' : 'swap_horiz'}
          </span>
        </button>
      </div>

      <h4 className="font-bold text-xs text-[#0b1c30] mt-1.5 line-clamp-1 group-hover:text-[#003820] transition-colors">
        {card.title}
      </h4>

      {isPastColumn && (
        <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-1">
          <span className="material-symbols-outlined text-xs">history</span>
          Past Day • Drag to future day
        </span>
      )}

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#e5eeff]/80 text-[11px] text-[#404942]">
        <span className="flex items-center gap-1 font-mono">
          <span className="material-symbols-outlined text-xs">timer</span>
          {card.durationMinutes}m
        </span>
        <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#002111] font-semibold text-[10px]">
          {card.tag}
        </span>
      </div>
    </div>
  );
};
