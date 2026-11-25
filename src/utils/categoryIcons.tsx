import React from 'react';
import {
  Cake,
  Candy,
  Croissant,
  Cookie,
  Gift,
  Coffee,
  Tag,
  Layers,
  Star,
} from 'lucide-react';

export function getCategoryIcon(
  categoryIdOrName: string
): React.ComponentType<{ className?: string }> {
  const key = categoryIdOrName.toLowerCase();
  if (key === 'all' || key.includes('all')) return Layers;
  if (key === 'favourites' || key.includes('fav')) return Star;
  if (key.includes('cake') || key.includes('pastr')) return Cake;
  if (key.includes('sweet') || key.includes('mithai') || key.includes('bengali')) return Candy;
  if (key.includes('bread') || key.includes('savor') || key.includes('croissant')) return Croissant;
  if (key.includes('cookie') || key.includes('rusk') || key.includes('dry')) return Cookie;
  if (key.includes('box') || key.includes('hamper') || key.includes('gift')) return Gift;
  if (key.includes('bever') || key.includes('chai') || key.includes('coffee')) return Coffee;
  return Tag;
}

export const CategoryIcon: React.FC<{ category: string; className?: string }> = ({
  category,
  className = 'w-4 h-4',
}) => {
  const Icon = getCategoryIcon(category);
  return <Icon className={className} />;
};
