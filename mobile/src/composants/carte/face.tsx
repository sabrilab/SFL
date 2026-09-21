/**
 * Point d'entrée natif de la face : Skia est natif sur iOS et Android, le
 * module se charge normalement. La version web (`face.web.tsx`) diffère le
 * chargement du module jusqu'à ce que CanvasKit soit prêt.
 */
export { FaceCarte } from './face.skia';
