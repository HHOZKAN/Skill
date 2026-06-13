
interface IconProps { size?: number; className?: string }

function Icon({ d, paths, size = 16, className = '' }: { d?: string; paths?: string[]; size?: number; className?: string }) {
  return (
    <svg className={`ic ${className}`} viewBox="0 0 24 24" width={size} height={size}>
      {paths ? paths.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
    </svg>
  );
}

export const IPlus    = (p: IconProps) => <Icon {...p} d="M12 5v14M5 12h14" />;
export const IMinus   = (p: IconProps) => <Icon {...p} d="M5 12h14" />;
export const IBack    = (p: IconProps) => <Icon {...p} d="M15 19l-7-7 7-7" />;
export const IHome    = (p: IconProps) => <Icon {...p} paths={['M3 11l9-8 9 8','M5 9.5V20h14V9.5']} />;
export const ILink    = (p: IconProps) => <Icon {...p} paths={['M9.5 14.5l5-5','M8 10l-1.8 1.8a3.5 3.5 0 005 5L13 15','M16 14l1.8-1.8a3.5 3.5 0 00-5-5L11 9']} />;
export const ITrash   = (p: IconProps) => <Icon {...p} paths={['M4 7h16','M9 7V5h6v2','M6 7l1 13h10l1-13','M10 11v6M14 11v6']} />;
export const IEdit    = (p: IconProps) => <Icon {...p} paths={['M4 20h4l10-10-4-4L4 16v4z','M13.5 6.5l4 4']} />;
export const INote    = (p: IconProps) => <Icon {...p} paths={['M6 3h9l5 5v13H6z','M14 3v6h6','M9 13h6M9 17h4']} />;
export const IExpand  = (p: IconProps) => <Icon {...p} paths={['M4 9V4h5','M20 15v5h-5','M20 9V4h-5','M4 15v5h5']} />;
export const IRecenter= (p: IconProps) => <Icon {...p} paths={['M12 3v3M12 18v3M3 12h3M18 12h3','M12 8.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z']} />;
export const IX       = (p: IconProps) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />;
export const ICheck   = (p: IconProps) => <Icon {...p} d="M5 12.5l4.5 4.5L19 7" />;
export const IPen     = (p: IconProps) => <Icon {...p} paths={['M4 20h4l10-10-4-4L4 16v4z','M13.5 6.5l4 4']} />;
export const IText    = (p: IconProps) => <Icon {...p} paths={['M5 7V5h14v2','M12 5v14','M9 19h6']} />;
export const IHand    = (p: IconProps) => <Icon {...p} paths={['M8 11V5.5a1.5 1.5 0 013 0V11','M11 11V4.5a1.5 1.5 0 013 0V11','M14 11V6.5a1.5 1.5 0 013 0V13c0 3.5-2 6-5.5 6S6 16.5 6 13v-1.5a1.5 1.5 0 013 0']} />;
export const IEraser  = (p: IconProps) => <Icon {...p} paths={['M7 17l-3-3 9-9 6 6-6 6H7z','M4 20h16']} />;
export const IUndo    = (p: IconProps) => <Icon {...p} paths={['M9 7L4 12l5 5','M4 12h11a4 4 0 010 8h-3']} />;
export const IClear   = (p: IconProps) => <Icon {...p} paths={['M4 7h16','M9 7V5h6v2','M6 7l1 13h10l1-13']} />;
export const ICloud   = (p: IconProps) => <Icon {...p} paths={['M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z']} />;
