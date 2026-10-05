import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BoardCard } from '../../types/wizard';

interface DraggableTopicCardProps {
  card: BoardCard;
  isPastColumn: boolean;
  onCardClick: (card: BoardCard) => void;
  isBoardLocked?: boolean;
  onRemoveTopic?: (topicId: string, topicTitle?: string) => void;
  onRemoveCard?: (card: BoardCard) => void;
}

export const DraggableTopicCard: React.FC<DraggableTopicCardProps> = ({
  card,
  isPastColumn,
  onCardClick,
  isBoardLocked = false,
  onRemoveTopic,
  onRemoveCard,
}) => {
  // Collapsed by default showing just the chapter header
  const [isExpanded, setIsExpanded] = useState(false);
  const pointerStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    disabled: isBoardLocked,
    data: {
      card,
      dayNumber: card.dayNumber,
    },
  });

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isBoardLocked) return;
    if (pointerStartRef.current) {
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 5 || dy > 5) {
        // Drag gesture occurred; suppress click-to-shift
        return;
      }
    }
    onCardClick(card);
  };

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
      case 'Math':
      case 'Calculus III':
        return 'bg-blue-100 text-blue-700';
      case 'Biology':
        return 'bg-[#e8f8ee] text-[#10b981]';
      case 'Sprint Review':
        return 'bg-[#6ffbbe]/40 text-[#002113]';
      default:
        return 'bg-[#eff4ff] text-[#404942]';
    }
  };

  const topicsList = card.topics || [];
  const topicCount = topicsList.length > 0 ? topicsList.length : 1;
  const isCardCarriedOver = Boolean(card.isCarriedOver || topicsList.some((t) => t.isCarriedOver));

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        handlePointerDown(e);
        listeners?.onPointerDown?.(e);
      }}
      onClick={handleCardClick}
      className={`rounded-xl p-3.5 shadow-xs border transition-all select-none group relative ${
        isBoardLocked
          ? 'cursor-default'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md'
      } ${
        isCardCarriedOver
          ? 'bg-red-50/20 border-red-400 ring-2 ring-red-400/25'
          : isPastColumn
          ? 'border-amber-300/80 bg-amber-50/20'
          : 'bg-white border-[#c0c9c0]/40'
      }`}
    >
      {/* Chapter Card Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-semibold font-mono ${getSubjectBadgeStyle(
              card.subject
            )}`}
          >
            {card.subject}
          </span>

          {isCardCarriedOver && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Carried Over {card.carriedOverFromDay ? `(Day ${card.carriedOverFromDay})` : ''}
            </span>
          )}
        </div>

        {/* Action Controls Header: Expand/Collapse & Shift */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Expand/Collapse Toggle Button */}
          {topicsList.length > 0 && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded((prev) => !prev);
              }}
              className="p-1 rounded-md text-[#707971] hover:text-[#003820] hover:bg-[#eff4ff] transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse topic list' : 'Expand topics in this chapter'}
            >
              <span className="material-symbols-outlined text-sm leading-none">
                {isExpanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          )}

          {/* Shift Action Button */}
          <button
            type="button"
            disabled={isBoardLocked}
            onPointerDown={(e) => e.stopPropagation()}
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
            title={
              isBoardLocked
                ? 'Save challenge first to unlock shifting'
                : 'Shift chapter to another day'
            }
          >
            <span className="material-symbols-outlined text-sm leading-none">
              {isBoardLocked ? 'lock' : 'swap_horiz'}
            </span>
          </button>

          {/* Remove Card Action Button */}
          {onRemoveCard && (
            <button
              type="button"
              disabled={isBoardLocked}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (!isBoardLocked) {
                  onRemoveCard(card);
                }
              }}
              className={`p-1 rounded-md transition-colors ${
                isBoardLocked
                  ? 'text-[#c0c9c0] cursor-not-allowed'
                  : 'text-[#707971] hover:text-[#ba1a1a] hover:bg-red-50 cursor-pointer'
              }`}
              title={
                isBoardLocked
                  ? 'Save challenge first to unlock removing'
                  : `Remove "${card.chapterName || card.title}" from sprint`
              }
            >
              <span className="material-symbols-outlined text-sm leading-none">
                delete
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Chapter Title */}
      <h4 className="font-bold text-xs text-[#0b1c30] mt-1.5 group-hover:text-[#003820] transition-colors">
        {card.chapterName || card.title}
      </h4>

      {isPastColumn && (
        <span className="text-[10px] text-amber-700 font-medium flex items-center gap-1 mt-1">
          <span className="material-symbols-outlined text-xs">history</span>
          Past Day • Drag to future day
        </span>
      )}

      {/* Chapter Summary Bar */}
      <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-[#e5eeff]/80 text-[11px] text-[#404942]">
        <span className="flex items-center gap-1 font-mono">
          <span className="material-symbols-outlined text-xs">timer</span>
          {card.durationMinutes}m
        </span>

        <span className="px-2 py-0.5 rounded bg-[#6ffbbe]/30 text-[#002111] font-semibold text-[10px]">
          {topicCount} {topicCount === 1 ? 'topic' : 'topics'}
        </span>
      </div>

      {/* Expandable Topic Rows inside Chapter */}
      {isExpanded && topicsList.length > 0 && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-2.5 pt-2 border-t border-[#e5eeff] space-y-1.5"
        >
          {topicsList.map((top) => (
            <div
              key={top.id}
              className={`p-2 rounded-lg text-[11px] border transition-all flex items-center justify-between gap-2 ${
                top.isCarriedOver
                  ? 'bg-red-50/80 border-red-300 text-red-900 ring-1 ring-red-400/20'
                  : 'bg-[#f8fafc] border-[#e2e8f0] text-[#0b1c30]'
              }`}
            >
              <div className="flex flex-col min-w-0">
                <span className="font-semibold truncate">{top.title}</span>
                {top.subconcept && (
                  <span className="text-[10px] text-[#707971] truncate">{top.subconcept}</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {top.isCarriedOver && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-300">
                    Spilled
                  </span>
                )}
                <span className="font-mono text-[10px] text-[#707971]">
                  {top.durationMinutes}m
                </span>
                {onRemoveTopic && (
                  <button
                    type="button"
                    disabled={isBoardLocked}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isBoardLocked) {
                        onRemoveTopic(top.id, top.title);
                      }
                    }}
                    className={`p-0.5 rounded transition-colors ${
                      isBoardLocked
                        ? 'text-[#c0c9c0] cursor-not-allowed'
                        : 'text-[#707971] hover:text-[#ba1a1a] hover:bg-red-50 cursor-pointer'
                    }`}
                    title={`Remove "${top.title}" from sprint`}
                  >
                    <span className="material-symbols-outlined text-xs leading-none">close</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
