// Les emblèmes des badges (lucide), partagés par la vitrine de Ma carte et le
// badge en verre posé sur la carte.

import {
  Award,
  CalendarCheck,
  Crown,
  Forward,
  Goal,
  Shield,
  Trophy,
  Zap,
} from "lucide-react";
import type { ClassementId } from "@/lib/sfl/fin-de-saison";
import type { TropheeId } from "@/lib/sfl/trophees";

export const EMBLEMES: Record<TropheeId, typeof Crown> = {
  buts: Goal,
  passes: Forward,
  matchs: CalendarCheck,
  victoires: Trophy,
  mvp: Award,
  mur: Shield,
  impact: Zap,
};

export const EMBLEMES_SAISON: Record<ClassementId, typeof Crown> = {
  pepite: Crown,
  buteur: Goal,
  passeur: Forward,
  defenseur: Shield,
  mvp: Award,
};
