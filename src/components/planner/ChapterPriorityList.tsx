import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChapterPriorityEntry } from '../../types/wizard';

interface ChapterPriorityListProps {
  items: ChapterPriorityEntry[];
  onReorder: (next: ChapterPriorityEntry[]) => void;
}

interface SortableRowProps {
  item: ChapterPriorityEntry;
  index: number;
}

interface PastelPalette {
  bg: string;
  border: string;
  text: string;
  subjectText: string;
  rankBg: string;
  rankText: string;
  rankBorder: string;
  handleHover: string;
  handleText: string;
}

const LIGHT_PASTEL_PALETTES: PastelPalette[] = [
  // Pastel Lavender / Violet
  {
    bg: 'bg-[#faf5ff]',
    border: 'border-[#e9d5ff]',
    text: 'text-[#3b0764]',
    subjectText: 'text-[#6b21a8]',
    rankBg: 'bg-[#f3e8ff]',
    rankText: 'text-[#581c87]',
    rankBorder: 'border-[#d8b4fe]',
    handleHover: 'hover:bg-[#f3e8ff]',
    handleText: 'text-[#7e22ce]',
  },
  // Pastel Mint / Emerald
  {
    bg: 'bg-[#f0fdf4]',
    border: 'border-[#bbf7d0]',
    text: 'text-[#052e16]',
    subjectText: 'text-[#15803d]',
    rankBg: 'bg-[#dcfce7]',
    rankText: 'text-[#14532d]',
    rankBorder: 'border-[#86efac]',
    handleHover: 'hover:bg-[#dcfce7]',
    handleText: 'text-[#16a34a]',
  },
  // Pastel Rose / Pink
  {
    bg: 'bg-[#fff1f2]',
    border: 'border-[#fecdd3]',
    text: 'text-[#4c0519]',
    subjectText: 'text-[#be123c]',
    rankBg: 'bg-[#ffe4e6]',
    rankText: 'text-[#881337]',
    rankBorder: 'border-[#fda4af]',
    handleHover: 'hover:bg-[#ffe4e6]',
    handleText: 'text-[#e11d48]',
  },
  // Pastel Powder Blue / Sky
  {
    bg: 'bg-[#f0f9ff]',
    border: 'border-[#bae6fd]',
    text: 'text-[#082f49]',
    subjectText: 'text-[#0369a1]',
    rankBg: 'bg-[#e0f2fe]',
    rankText: 'text-[#0c4a6e]',
    rankBorder: 'border-[#7dd3fc]',
    handleHover: 'hover:bg-[#e0f2fe]',
    handleText: 'text-[#0284c7]',
  },
  // Pastel Warm Peach / Amber
  {
    bg: 'bg-[#fff7ed]',
    border: 'border-[#fed7aa]',
    text: 'text-[#431407]',
    subjectText: 'text-[#c2410c]',
    rankBg: 'bg-[#ffedd5]',
    rankText: 'text-[#7c2d12]',
    rankBorder: 'border-[#fdba74]',
    handleHover: 'hover:bg-[#ffedd5]',
    handleText: 'text-[#ea580c]',
  },
  // Pastel Sage / Teal
  {
    bg: 'bg-[#f0fdfa]',
    border: 'border-[#99f6e4]',
    text: 'text-[#042f2e]',
    subjectText: 'text-[#0f766e]',
    rankBg: 'bg-[#ccfbf1]',
    rankText: 'text-[#115e59]',
    rankBorder: 'border-[#5eead4]',
    handleHover: 'hover:bg-[#ccfbf1]',
    handleText: 'text-[#0d9488]',
  },
  // Pastel Cream / Yellow
  {
    bg: 'bg-[#fefce8]',
    border: 'border-[#fef08a]',
    text: 'text-[#422006]',
    subjectText: 'text-[#a16207]',
    rankBg: 'bg-[#fef9c3]',
    rankText: 'text-[#713f12]',
    rankBorder: 'border-[#fde047]',
    handleHover: 'hover:bg-[#fef9c3]',
    handleText: 'text-[#ca8a04]',
  },
  // Pastel Indigo / Periwinkle
  {
    bg: 'bg-[#eef2ff]',
    border: 'border-[#c7d2fe]',
    text: 'text-[#1e1b4b]',
    subjectText: 'text-[#4338ca]',
    rankBg: 'bg-[#e0e7ff]',
    rankText: 'text-[#312e81]',
    rankBorder: 'border-[#a5b4fc]',
    handleHover: 'hover:bg-[#e0e7ff]',
    handleText: 'text-[#4f46e5]',
  },
];

function getSubjectPastelPalette(subject: string): PastelPalette {
  if (!subject) return LIGHT_PASTEL_PALETTES[0];
  let hash = 0;
  const normalized = subject.trim().toLowerCase();
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % LIGHT_PASTEL_PALETTES.length;
  return LIGHT_PASTEL_PALETTES[index];
}

const SortableRow: React.FC<SortableRowProps> = ({ item, index }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.chapterId,
  });

  const palette = getSubjectPastelPalette(item.subject);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group flex items-center gap-3 p-3 rounded-2xl border ${palette.border} ${palette.bg} ${
        isDragging ? 'shadow-lg ring-2 ring-black/10 scale-[1.02]' : 'shadow-xs hover:shadow-md'
      } transition-all duration-200`}
    >
      {/* Grip Icon */}
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className={`cursor-grab active:cursor-grabbing p-1.5 rounded-lg ${palette.handleHover} ${palette.handleText} transition-colors flex items-center justify-center`}
        aria-label={`Drag handle for chapter ${item.chapterName}`}
      >
        <span className="material-symbols-outlined text-lg">drag_indicator</span>
      </div>

      {/* Rank Badge */}
      <div className={`flex-shrink-0 w-6 h-6 rounded-full ${palette.rankBg} border ${palette.rankBorder} flex items-center justify-center text-[10px] font-black font-mono ${palette.rankText}`}>
        {index + 1}
      </div>

      {/* Chapter & Subject Info */}
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-xs ${palette.text} truncate`}>{item.chapterName}</h4>
        <p className={`text-[10px] font-mono ${palette.subjectText} font-semibold uppercase tracking-wider truncate`}>
          {item.subject}
        </p>
      </div>
    </div>
  );
};

export const ChapterPriorityList: React.FC<ChapterPriorityListProps> = ({ items, onReorder }) => {
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 3,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.chapterId === active.id);
      const newIndex = items.findIndex((i) => i.chapterId === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(arrayMove(items, oldIndex, newIndex));
      }
    }
  };

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.chapterId)} strategy={verticalListSortingStrategy}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((item, idx) => (
            <SortableRow key={item.chapterId} item={item} index={idx} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
