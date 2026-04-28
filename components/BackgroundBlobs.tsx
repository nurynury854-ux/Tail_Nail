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
        {/* ── LARGE ORGANIC BLOBS ─────────────────────────── */}

        {/* Top-left sage green — the hero blob from the screenshot */}
        <path
          d="M -60 -30 C 80 -60, 300 20, 330 170 C 360 310, 210 430, 50 395 C -110 360, -190 215, -145 95 C -120 35, -80 0, -60 -30 Z"
          fill="#8FB896"
          opacity="0.30"
        />

        {/* Top-right warm gold */}
        <path
          d="M 1200 -60 C 1370 -80, 1510 50, 1485 195 C 1460 330, 1315 385, 1170 320 C 1025 255, 990 110, 1100 35 C 1145 5, 1170 -40, 1200 -60 Z"
          fill="#D4A843"
          opacity="0.22"
        />

        {/* Mid-left peach */}
        <path
          d="M -120 440 C 30 375, 195 415, 210 545 C 225 670, 75 750, -90 710 C -255 670, -290 510, -120 440 Z"
          fill="#E8A07A"
          opacity="0.22"
        />

        {/* Mid-right dusty blue */}
        <path
          d="M 1385 390 C 1525 345, 1590 490, 1530 615 C 1470 735, 1305 750, 1205 655 C 1105 560, 1145 405, 1385 390 Z"
          fill="#7B9BC4"
          opacity="0.20"
        />

        {/* Bottom-left soft lavender */}
        <path
          d="M -40 810 C 130 745, 295 790, 310 910 C 325 1030, 135 1070, -50 1028 C -235 985, -250 870, -40 810 Z"
          fill="#B8A0C8"
          opacity="0.22"
        />

        {/* Bottom-right muted rose */}
        <path
          d="M 1265 830 C 1410 785, 1510 890, 1465 990 C 1420 1090, 1275 1105, 1150 1025 C 1025 945, 1075 845, 1265 830 Z"
          fill="#C8849A"
          opacity="0.20"
        />

        {/* Top-centre wavy cream accent */}
        <path
          d="M 260 -25 C 390 -55, 550 15, 650 -5 C 750 -25, 860 25, 940 0 C 1020 -22, 1100 28, 1120 -15 L 1120 -90 L 260 -90 Z"
          fill="#EDE0CC"
          opacity="0.32"
        />

        {/* Small floating gold bubble — upper centre */}
        <path
          d="M 620 65 C 660 42, 725 54, 733 95 C 741 135, 698 158, 658 147 C 618 136, 598 95, 620 65 Z"
          fill="#D4A843"
          opacity="0.18"
        />

        {/* ── PAW PRINTS ────────────────────────────────────── */}

        {/* Paw 1 — upper left, clearly visible */}
        <g transform="translate(210, 240) rotate(-18)" opacity="0.20" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="12" ry="14" />
          <ellipse cx="-17" cy="-15" rx="6.5" ry="7.5" />
          <ellipse cx="0" cy="-20" rx="6.5" ry="7.5" />
          <ellipse cx="17" cy="-15" rx="6.5" ry="7.5" />
        </g>

        {/* Paw 2 — upper right */}
        <g transform="translate(1245, 155) rotate(15)" opacity="0.17" fill="#7B9BC4">
          <ellipse cx="0" cy="0" rx="11" ry="13" />
          <ellipse cx="-15" cy="-13" rx="6" ry="7" />
          <ellipse cx="0" cy="-18" rx="6" ry="7" />
          <ellipse cx="15" cy="-13" rx="6" ry="7" />
        </g>

        {/* Paw 3 — centre of page */}
        <g transform="translate(720, 455) rotate(-8)" opacity="0.14" fill="#D4A843">
          <ellipse cx="0" cy="0" rx="13" ry="15" />
          <ellipse cx="-18" cy="-16" rx="7" ry="8" />
          <ellipse cx="0" cy="-22" rx="7" ry="8" />
          <ellipse cx="18" cy="-16" rx="7" ry="8" />
        </g>

        {/* Paw 4 — left mid strip */}
        <g transform="translate(75, 565) rotate(10)" opacity="0.14" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="10" ry="12" />
          <ellipse cx="-14" cy="-13" rx="5.5" ry="6.5" />
          <ellipse cx="0" cy="-17" rx="5.5" ry="6.5" />
          <ellipse cx="14" cy="-13" rx="5.5" ry="6.5" />
        </g>

        {/* Paw 5 — right strip */}
        <g transform="translate(1385, 565) rotate(22)" opacity="0.14" fill="#B8A0C8">
          <ellipse cx="0" cy="0" rx="10" ry="12" />
          <ellipse cx="-14" cy="-13" rx="5.5" ry="6.5" />
          <ellipse cx="0" cy="-17" rx="5.5" ry="6.5" />
          <ellipse cx="14" cy="-13" rx="5.5" ry="6.5" />
        </g>

        {/* Paw 6 — bottom left */}
        <g transform="translate(225, 828) rotate(-22)" opacity="0.14" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="11" ry="13" />
          <ellipse cx="-15" cy="-14" rx="6" ry="7" />
          <ellipse cx="0" cy="-19" rx="6" ry="7" />
          <ellipse cx="15" cy="-14" rx="6" ry="7" />
        </g>

        {/* Paw 7 — bottom right */}
        <g transform="translate(1105, 805) rotate(14)" opacity="0.14" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="10" ry="12" />
          <ellipse cx="-14" cy="-13" rx="5.5" ry="6.5" />
          <ellipse cx="0" cy="-17" rx="5.5" ry="6.5" />
          <ellipse cx="14" cy="-13" rx="5.5" ry="6.5" />
        </g>

        {/* ── 4-POINTED SPARKLE STARS ───────────────────────── */}
        {/* Curved 4-point star: M cx,top  C ... cx,bottom  C ... cx,top  */}

        {/* Gold — upper centre left */}
        <path
          d="M 425,118 C 427,110 430,107 438,105 C 430,103 427,100 425,92
             C 423,100 420,103 412,105 C 420,107 423,110 425,118 Z"
          fill="#D4A843" opacity="0.60"
        />

        {/* Blue — upper right */}
        <path
          d="M 1055,88 C 1058,78 1062,74 1072,71 C 1062,68 1058,64 1055,54
             C 1052,64 1048,68 1038,71 C 1048,74 1052,78 1055,88 Z"
          fill="#7B9BC4" opacity="0.55"
        />

        {/* Rose — mid right */}
        <path
          d="M 1162,343 C 1164,335 1168,332 1176,330 C 1168,328 1164,325 1162,317
             C 1160,325 1156,328 1148,330 C 1156,332 1160,335 1162,343 Z"
          fill="#C8849A" opacity="0.52"
        />

        {/* Sage — mid left */}
        <path
          d="M 262,394 C 264,385 268,382 276,380 C 268,378 264,375 262,366
             C 260,375 256,378 248,380 C 256,382 260,385 262,394 Z"
          fill="#8FB896" opacity="0.52"
        />

        {/* Gold — bottom centre */}
        <path
          d="M 942,783 C 944,774 948,771 956,769 C 948,767 944,764 942,755
             C 940,764 936,767 928,769 C 936,771 940,774 942,783 Z"
          fill="#D4A843" opacity="0.48"
        />

        {/* Lavender — lower left */}
        <path
          d="M 502,864 C 504,855 508,852 516,850 C 508,848 504,845 502,836
             C 500,845 496,848 488,850 C 496,852 500,855 502,864 Z"
          fill="#B8A0C8" opacity="0.48"
        />

        {/* Extra small sparkle — right of centre */}
        <path
          d="M 850,310 C 851,305 853,303 858,302 C 853,301 851,299 850,294
             C 849,299 847,301 842,302 C 847,303 849,305 850,310 Z"
          fill="#C8849A" opacity="0.45"
        />

        {/* ── SCATTER DOTS ──────────────────────────────────── */}
        {/* Gold cluster near top */}
        <circle cx="682" cy="56"  r="3.5" fill="#D4A843" opacity="0.42" />
        <circle cx="698" cy="49"  r="2.5" fill="#D4A843" opacity="0.32" />
        <circle cx="711" cy="60"  r="2"   fill="#D4A843" opacity="0.26" />

        {/* Rose cluster — lower right */}
        <circle cx="1305" cy="725" r="3"  fill="#C8849A" opacity="0.36" />
        <circle cx="1322" cy="716" r="2"  fill="#C8849A" opacity="0.28" />

        {/* Scattered singles */}
        <circle cx="182" cy="352"  r="3"   fill="#8FB896" opacity="0.30" />
        <circle cx="342" cy="94"   r="3"   fill="#D4A843" opacity="0.34" />
        <circle cx="862" cy="822"  r="2.5" fill="#B8A0C8" opacity="0.32" />
        <circle cx="572" cy="162"  r="2"   fill="#C8849A" opacity="0.30" />
        <circle cx="1022" cy="642" r="2.5" fill="#7B9BC4" opacity="0.30" />
        <circle cx="460"  cy="700" r="2"   fill="#8FB896" opacity="0.26" />
        <circle cx="1180" cy="480" r="2"   fill="#D4A843" opacity="0.26" />
      </svg>
    </div>
  )
}
