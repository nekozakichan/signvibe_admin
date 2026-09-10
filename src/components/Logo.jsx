import spedLogo from '../assets/sped-logo-256.png';

/**
 * Urdaneta City SPED Center seal, used as the SignVibe portal mark.
 *
 * The source artwork (src/assets/sped_logo.png, 1254px) is kept untouched for
 * print use; this component ships a 256px copy so a 36px avatar doesn't pull
 * 1.7 MB down the wire.
 *
 * @param size   rendered width/height in px
 * @param ring   draw a soft white ring — use on the teal sidebar
 * @param idle   gentle breathing animation
 */
export default function Logo({
  size = 36,
  ring = false,
  idle = false,
  className = '',
  style,
  alt = 'Urdaneta City SPED Center',
}) {
  const classes = [
    'sv-logo',
    ring ? 'sv-logo-ring' : '',
    idle ? 'sv-logo-idle' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <img
      src={spedLogo}
      alt={alt}
      width={size}
      height={size}
      draggable="false"
      className={classes}
      style={{ width: size, height: size, ...style }}
    />
  );
}
