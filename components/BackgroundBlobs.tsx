export default function BackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* TOP-LEFT gold / honey blob */}
        <path
          d="M -80 0 C 60 -40, 220 10, 260 110 C 300 210, 200 320, 80 300 C -40 280, -100 180, -80 0 Z"
          fill="#D4A843"
          opacity="0.22"
        />

        {/* TOP-RIGHT dusty-blue blob */}
        <path
          d="M 1440 0 C 1540 -20, 1580 120, 1520 230 C 1460 340, 1340 360, 1260 270 C 1180 180, 1220 40, 1440 0 Z"
          fill="#7B9BC4"
          opacity="0.20"
        />

        {/* MID-LEFT sage-green blob */}
        <path
          d="M -100 380 C 20 320, 140 370, 160 470 C 180 570, 60 650, -60 620 C -180 590, -220 440, -100 380 Z"
          fill="#8FB896"
          opacity="0.20"
        />

        {/* MID-RIGHT peach / coral blob */}
        <path
          d="M 1440 350 C 1560 320, 1600 460, 1540 560 C 1480 660, 1360 670, 1280 590 C 1200 510, 1220 370, 1440 350 Z"
          fill="#E8A07A"
          opacity="0.18"
        />

        {/* BOTTOM-LEFT soft lavender blob */}
        <path
          d="M -60 780 C 80 720, 220 760, 240 860 C 260 960, 120 1020, -20 980 C -160 940, -200 840, -60 780 Z"
          fill="#B8A0C8"
          opacity="0.20"
        />

        {/* BOTTOM-RIGHT warm gold blob */}
        <path
          d="M 1340 800 C 1460 760, 1540 860, 1500 960 C 1460 1060, 1320 1080, 1220 1000 C 1120 920, 1160 840, 1340 800 Z"
          fill="#D4A843"
          opacity="0.18"
        />

        {/* BOTTOM-CENTRE muted rose blob */}
        <path
          d="M 580 820 C 660 780, 780 800, 820 880 C 860 960, 780 1020, 680 1010 C 580 1000, 520 940, 580 820 Z"
          fill="#C8849A"
          opacity="0.12"
        />

        {/* Paw 1 — top-left area */}
        <g transform="translate(130, 190) rotate(-18)" opacity="0.10" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="9" ry="11" />
          <ellipse cx="-13" cy="-11" rx="5" ry="6" />
          <ellipse cx="0" cy="-15" rx="5" ry="6" />
          <ellipse cx="13" cy="-11" rx="5" ry="6" />
        </g>

        {/* Paw 2 — top-right area */}
        <g transform="translate(1280, 120) rotate(15)" opacity="0.09" fill="#7B9BC4">
          <ellipse cx="0" cy="0" rx="9" ry="11" />
          <ellipse cx="-13" cy="-11" rx="5" ry="6" />
          <ellipse cx="0" cy="-15" rx="5" ry="6" />
          <ellipse cx="13" cy="-11" rx="5" ry="6" />
        </g>

        {/* Paw 3 — left strip */}
        <g transform="translate(60, 530) rotate(8)" opacity="0.08" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="8" ry="10" />
          <ellipse cx="-12" cy="-10" rx="4.5" ry="5.5" />
          <ellipse cx="0" cy="-14" rx="4.5" ry="5.5" />
          <ellipse cx="12" cy="-10" rx="4.5" ry="5.5" />
        </g>

        {/* Paw 4 — centre */}
        <g transform="translate(720, 460) rotate(-10)" opacity="0.06" fill="#D4A843">
          <ellipse cx="0" cy="0" rx="9" ry="11" />
          <ellipse cx="-13" cy="-11" rx="5" ry="6" />
          <ellipse cx="0" cy="-15" rx="5" ry="6" />
          <ellipse cx="13" cy="-11" rx="5" ry="6" />
        </g>

        {/* Paw 5 — right strip */}
        <g transform="translate(1380, 550) rotate(22)" opacity="0.08" fill="#B8A0C8">
          <ellipse cx="0" cy="0" rx="8" ry="10" />
          <ellipse cx="-12" cy="-10" rx="4.5" ry="5.5" />
          <ellipse cx="0" cy="-14" rx="4.5" ry="5.5" />
          <ellipse cx="12" cy="-10" rx="4.5" ry="5.5" />
        </g>

        {/* Paw 6 — bottom-left */}
        <g transform="translate(200, 820) rotate(-25)" opacity="0.08" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="9" ry="11" />
          <ellipse cx="-13" cy="-11" rx="5" ry="6" />
          <ellipse cx="0" cy="-15" rx="5" ry="6" />
          <ellipse cx="13" cy="-11" rx="5" ry="6" />
        </g>

        {/* Paw 7 — bottom-right */}
        <g transform="translate(1100, 810) rotate(12)" opacity="0.08" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="8" ry="10" />
          <ellipse cx="-12" cy="-10" rx="4.5" ry="5.5" />
          <ellipse cx="0" cy="-14" rx="4.5" ry="5.5" />
          <ellipse cx="12" cy="-10" rx="4.5" ry="5.5" />
        </g>

        {/* sparkle dots */}
        <circle cx="340" cy="95" r="3.5" fill="#D4A843" opacity="0.22" />
        <circle cx="420" cy="140" r="2.5" fill="#D4A843" opacity="0.18" />
        <circle cx="1040" cy="80" r="3" fill="#7B9BC4" opacity="0.20" />
        <circle cx="940" cy="780" r="3" fill="#C8849A" opacity="0.18" />
        <circle cx="500" cy="860" r="2.5" fill="#B8A0C8" opacity="0.20" />
        <circle cx="200" cy="350" r="3" fill="#8FB896" opacity="0.18" />
      </svg>
    </div>
  )
}
