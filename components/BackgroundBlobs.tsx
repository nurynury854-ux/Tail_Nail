export default function BackgroundBlobs() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* ═══════════════════════════════════════════════
          DESKTOP  (md and above)
      ═══════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 1440 900"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full hidden md:block"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Top-left sage green */}
        <path d="M -60 -30 C 80 -60, 300 20, 330 170 C 360 310, 210 430, 50 395 C -110 360, -190 215, -145 95 C -120 35, -80 0, -60 -30 Z" fill="#8FB896" opacity="0.30" />
        {/* Top-right warm gold */}
        <path d="M 1200 -60 C 1370 -80, 1510 50, 1485 195 C 1460 330, 1315 385, 1170 320 C 1025 255, 990 110, 1100 35 C 1145 5, 1170 -40, 1200 -60 Z" fill="#D4A843" opacity="0.22" />
        {/* Mid-left peach */}
        <path d="M -120 440 C 30 375, 195 415, 210 545 C 225 670, 75 750, -90 710 C -255 670, -290 510, -120 440 Z" fill="#E8A07A" opacity="0.22" />
        {/* Mid-right dusty blue */}
        <path d="M 1385 390 C 1525 345, 1590 490, 1530 615 C 1470 735, 1305 750, 1205 655 C 1105 560, 1145 405, 1385 390 Z" fill="#7B9BC4" opacity="0.20" />
        {/* Bottom-left soft lavender */}
        <path d="M -40 810 C 130 745, 295 790, 310 910 C 325 1030, 135 1070, -50 1028 C -235 985, -250 870, -40 810 Z" fill="#B8A0C8" opacity="0.22" />
        {/* Bottom-right muted rose */}
        <path d="M 1265 830 C 1410 785, 1510 890, 1465 990 C 1420 1090, 1275 1105, 1150 1025 C 1025 945, 1075 845, 1265 830 Z" fill="#C8849A" opacity="0.20" />
        {/* Top-centre wavy cream accent */}
        <path d="M 260 -25 C 390 -55, 550 15, 650 -5 C 750 -25, 860 25, 940 0 C 1020 -22, 1100 28, 1120 -15 L 1120 -90 L 260 -90 Z" fill="#EDE0CC" opacity="0.32" />
        {/* Small floating gold bubble */}
        <path d="M 620 65 C 660 42, 725 54, 733 95 C 741 135, 698 158, 658 147 C 618 136, 598 95, 620 65 Z" fill="#D4A843" opacity="0.18" />

        {/* Paw 1 upper left */}
        <g transform="translate(210,240) rotate(-18)" opacity="0.20" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="12" ry="14"/><ellipse cx="-17" cy="-15" rx="6.5" ry="7.5"/><ellipse cx="0" cy="-20" rx="6.5" ry="7.5"/><ellipse cx="17" cy="-15" rx="6.5" ry="7.5"/>
        </g>
        {/* Paw 2 upper right */}
        <g transform="translate(1245,155) rotate(15)" opacity="0.17" fill="#7B9BC4">
          <ellipse cx="0" cy="0" rx="11" ry="13"/><ellipse cx="-15" cy="-13" rx="6" ry="7"/><ellipse cx="0" cy="-18" rx="6" ry="7"/><ellipse cx="15" cy="-13" rx="6" ry="7"/>
        </g>
        {/* Paw 3 centre */}
        <g transform="translate(720,455) rotate(-8)" opacity="0.14" fill="#D4A843">
          <ellipse cx="0" cy="0" rx="13" ry="15"/><ellipse cx="-18" cy="-16" rx="7" ry="8"/><ellipse cx="0" cy="-22" rx="7" ry="8"/><ellipse cx="18" cy="-16" rx="7" ry="8"/>
        </g>
        {/* Paw 4 left mid */}
        <g transform="translate(75,565) rotate(10)" opacity="0.14" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="10" ry="12"/><ellipse cx="-14" cy="-13" rx="5.5" ry="6.5"/><ellipse cx="0" cy="-17" rx="5.5" ry="6.5"/><ellipse cx="14" cy="-13" rx="5.5" ry="6.5"/>
        </g>
        {/* Paw 5 right strip */}
        <g transform="translate(1385,565) rotate(22)" opacity="0.14" fill="#B8A0C8">
          <ellipse cx="0" cy="0" rx="10" ry="12"/><ellipse cx="-14" cy="-13" rx="5.5" ry="6.5"/><ellipse cx="0" cy="-17" rx="5.5" ry="6.5"/><ellipse cx="14" cy="-13" rx="5.5" ry="6.5"/>
        </g>
        {/* Paw 6 bottom left */}
        <g transform="translate(225,828) rotate(-22)" opacity="0.14" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="11" ry="13"/><ellipse cx="-15" cy="-14" rx="6" ry="7"/><ellipse cx="0" cy="-19" rx="6" ry="7"/><ellipse cx="15" cy="-14" rx="6" ry="7"/>
        </g>
        {/* Paw 7 bottom right */}
        <g transform="translate(1105,805) rotate(14)" opacity="0.14" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="10" ry="12"/><ellipse cx="-14" cy="-13" rx="5.5" ry="6.5"/><ellipse cx="0" cy="-17" rx="5.5" ry="6.5"/><ellipse cx="14" cy="-13" rx="5.5" ry="6.5"/>
        </g>

        {/* Sparkles */}
        <path d="M 425,118 C 427,110 430,107 438,105 C 430,103 427,100 425,92 C 423,100 420,103 412,105 C 420,107 423,110 425,118 Z" fill="#D4A843" opacity="0.60"/>
        <path d="M 1055,88 C 1058,78 1062,74 1072,71 C 1062,68 1058,64 1055,54 C 1052,64 1048,68 1038,71 C 1048,74 1052,78 1055,88 Z" fill="#7B9BC4" opacity="0.55"/>
        <path d="M 1162,343 C 1164,335 1168,332 1176,330 C 1168,328 1164,325 1162,317 C 1160,325 1156,328 1148,330 C 1156,332 1160,335 1162,343 Z" fill="#C8849A" opacity="0.52"/>
        <path d="M 262,394 C 264,385 268,382 276,380 C 268,378 264,375 262,366 C 260,375 256,378 248,380 C 256,382 260,385 262,394 Z" fill="#8FB896" opacity="0.52"/>
        <path d="M 942,783 C 944,774 948,771 956,769 C 948,767 944,764 942,755 C 940,764 936,767 928,769 C 936,771 940,774 942,783 Z" fill="#D4A843" opacity="0.48"/>
        <path d="M 502,864 C 504,855 508,852 516,850 C 508,848 504,845 502,836 C 500,845 496,848 488,850 C 496,852 500,855 502,864 Z" fill="#B8A0C8" opacity="0.48"/>
        <path d="M 850,310 C 851,305 853,303 858,302 C 853,301 851,299 850,294 C 849,299 847,301 842,302 C 847,303 849,305 850,310 Z" fill="#C8849A" opacity="0.45"/>

        {/* Botanical sprigs — bottom corners */}
        <g transform="translate(370,820) rotate(-8)" opacity="0.38" fill="#8FB896">
          <path d="M 0,0 C -4,-22 -2,-46 6,-68" stroke="#8FB896" strokeWidth="1.8" fill="none"/>
          <path d="M -2,-18 C -20,-28 -24,-44 -10,-47 C -4,-34 -2,-24 -2,-18 Z"/>
          <path d="M 2,-20 C 20,-30 24,-46 10,-49 C 4,-36 2,-26 2,-20 Z"/>
          <path d="M -1,-40 C -18,-50 -21,-66 -8,-69 C -2,-55 -1,-46 -1,-40 Z"/>
          <path d="M 3,-42 C 21,-52 23,-68 10,-71 C 5,-57 3,-48 3,-42 Z"/>
          <path d="M 5,-60 C 5,-78 -1,-88 7,-93 C 12,-80 9,-70 5,-60 Z"/>
        </g>
        <g transform="translate(1080,838) rotate(10)" opacity="0.34" fill="#8FB896">
          <path d="M 0,0 C -3,-18 -1,-38 5,-56" stroke="#8FB896" strokeWidth="1.5" fill="none"/>
          <path d="M -1,-15 C -16,-24 -19,-37 -8,-40 C -3,-28 -1,-20 -1,-15 Z"/>
          <path d="M 2,-17 C 17,-26 19,-39 8,-42 C 3,-30 2,-22 2,-17 Z"/>
          <path d="M 0,-33 C -14,-42 -16,-55 -6,-57 C -1,-45 0,-37 0,-33 Z"/>
          <path d="M 3,-35 C 17,-44 19,-57 9,-59 C 4,-47 3,-39 3,-35 Z"/>
        </g>

        {/* Scatter dots */}
        <circle cx="682" cy="56"  r="3.5" fill="#D4A843" opacity="0.42"/>
        <circle cx="698" cy="49"  r="2.5" fill="#D4A843" opacity="0.32"/>
        <circle cx="711" cy="60"  r="2"   fill="#D4A843" opacity="0.26"/>
        <circle cx="1305" cy="725" r="3"  fill="#C8849A" opacity="0.36"/>
        <circle cx="1322" cy="716" r="2"  fill="#C8849A" opacity="0.28"/>
        <circle cx="182" cy="352"  r="3"   fill="#8FB896" opacity="0.30"/>
        <circle cx="342" cy="94"   r="3"   fill="#D4A843" opacity="0.34"/>
        <circle cx="862" cy="822"  r="2.5" fill="#B8A0C8" opacity="0.32"/>
        <circle cx="572" cy="162"  r="2"   fill="#C8849A" opacity="0.30"/>
        <circle cx="1022" cy="642" r="2.5" fill="#7B9BC4" opacity="0.30"/>
        <circle cx="460"  cy="700" r="2"   fill="#8FB896" opacity="0.26"/>
        <circle cx="1180" cy="480" r="2"   fill="#D4A843" opacity="0.26"/>
      </svg>

      {/* ═══════════════════════════════════════════════
          MOBILE  (below md) — 390×860 canvas
      ═══════════════════════════════════════════════ */}
      <svg
        viewBox="0 0 390 860"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 h-full w-full block md:hidden"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* ── BLOBS ─────────────────────────────── */}

        {/* Sage green — top-left hero blob */}
        <path
          d="M -25 -15 C 65 -58, 215 -5, 228 118 C 241 241, 118 325, -8 298 C -134 271, -158 128, -92 42 C -66 8, -28 2, -25 -15 Z"
          fill="#8FB896" opacity="0.32"
        />

        {/* Gold — top-right corner accent */}
        <path
          d="M 325 -42 C 405 -65, 448 22, 430 112 C 412 202, 336 224, 272 174 C 208 124, 225 22, 292 -16 C 308 -30, 320 -38, 325 -42 Z"
          fill="#D4A843" opacity="0.22"
        />

        {/* Peach — bottom-left */}
        <path
          d="M -48 758 C 52 716, 178 748, 184 844 C 190 940, 62 968, -58 928 C -178 888, -184 796, -48 758 Z"
          fill="#E8A07A" opacity="0.28"
        />

        {/* Blue/slate — bottom-right */}
        <path
          d="M 352 768 C 448 738, 482 840, 454 928 C 426 1016, 308 1022, 234 948 C 160 874, 212 786, 352 768 Z"
          fill="#7B9BC4" opacity="0.26"
        />

        {/* Lavender — bottom-left secondary */}
        <path
          d="M -30 840 C 48 808, 128 828, 132 900 C 136 972, 54 990, -28 964 C -110 938, -120 870, -30 840 Z"
          fill="#B8A0C8" opacity="0.22"
        />

        {/* Cream wavy top accent */}
        <path
          d="M 60 -18 C 120 -42, 195 8, 248 -8 C 301 -24, 355 12, 390 -4 L 390 -70 L 60 -70 Z"
          fill="#EDE0CC" opacity="0.34"
        />

        {/* Small gold bubble — upper area */}
        <path
          d="M 158 54 C 180 38, 218 48, 223 80 C 228 112, 198 130, 172 122 C 146 114, 136 76, 158 54 Z"
          fill="#D4A843" opacity="0.18"
        />

        {/* ── PAW PRINTS ────────────────────────── */}

        {/* Paw 1 — upper left, rose, visible */}
        <g transform="translate(102,248) rotate(-15)" opacity="0.24" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="13" ry="15"/>
          <ellipse cx="-17" cy="-16" rx="6.5" ry="7.5"/>
          <ellipse cx="0" cy="-21" rx="6.5" ry="7.5"/>
          <ellipse cx="17" cy="-16" rx="6.5" ry="7.5"/>
        </g>

        {/* Paw 2 — right side, dusty rose */}
        <g transform="translate(342,312) rotate(18)" opacity="0.20" fill="#C8849A">
          <ellipse cx="0" cy="0" rx="11" ry="13"/>
          <ellipse cx="-15" cy="-14" rx="6" ry="7"/>
          <ellipse cx="0" cy="-18" rx="6" ry="7"/>
          <ellipse cx="15" cy="-14" rx="6" ry="7"/>
        </g>

        {/* Paw 3 — centre, gold, faint */}
        <g transform="translate(198,515) rotate(-8)" opacity="0.14" fill="#D4A843">
          <ellipse cx="0" cy="0" rx="12" ry="14"/>
          <ellipse cx="-16" cy="-15" rx="6" ry="7"/>
          <ellipse cx="0" cy="-20" rx="6" ry="7"/>
          <ellipse cx="16" cy="-15" rx="6" ry="7"/>
        </g>

        {/* Paw 4 — lower right, blue */}
        <g transform="translate(322,680) rotate(12)" opacity="0.16" fill="#7B9BC4">
          <ellipse cx="0" cy="0" rx="10" ry="12"/>
          <ellipse cx="-14" cy="-13" rx="5.5" ry="6.5"/>
          <ellipse cx="0" cy="-17" rx="5.5" ry="6.5"/>
          <ellipse cx="14" cy="-13" rx="5.5" ry="6.5"/>
        </g>

        {/* Paw 5 — lower left, sage */}
        <g transform="translate(68,760) rotate(-20)" opacity="0.16" fill="#8FB896">
          <ellipse cx="0" cy="0" rx="10" ry="12"/>
          <ellipse cx="-14" cy="-13" rx="5.5" ry="6.5"/>
          <ellipse cx="0" cy="-17" rx="5.5" ry="6.5"/>
          <ellipse cx="14" cy="-13" rx="5.5" ry="6.5"/>
        </g>

        {/* ── 4-POINTED SPARKLES ────────────────── */}

        {/* Gold — upper centre */}
        <path
          d="M 234,155 C 236,146 239,143 248,141 C 239,139 236,136 234,127 C 232,136 229,139 220,141 C 229,143 232,146 234,155 Z"
          fill="#D4A843" opacity="0.65"
        />

        {/* Blue/purple — left side */}
        <path
          d="M 46,328 C 48,318 52,314 62,311 C 52,308 48,304 46,294 C 44,304 40,308 30,311 C 40,314 44,318 46,328 Z"
          fill="#7B9BC4" opacity="0.58"
        />

        {/* Small gold — upper right */}
        <path
          d="M 318,168 C 320,161 322,159 328,157 C 322,155 320,153 318,146 C 316,153 314,155 308,157 C 314,159 316,161 318,168 Z"
          fill="#D4A843" opacity="0.55"
        />

        {/* Rose — right of centre */}
        <path
          d="M 358,438 C 360,430 363,428 370,426 C 363,424 360,422 358,414 C 356,422 353,424 346,426 C 353,428 356,430 358,438 Z"
          fill="#C8849A" opacity="0.50"
        />

        {/* Sage — mid left */}
        <path
          d="M 32,488 C 34,480 37,477 44,475 C 37,473 34,470 32,462 C 30,470 27,473 20,475 C 27,477 30,480 32,488 Z"
          fill="#8FB896" opacity="0.50"
        />

        {/* Gold — lower right */}
        <path
          d="M 354,720 C 356,712 359,709 366,707 C 359,705 356,702 354,694 C 352,702 349,705 342,707 C 349,709 352,712 354,720 Z"
          fill="#D4A843" opacity="0.48"
        />

        {/* Lavender — bottom left near heart */}
        <path
          d="M 55,700 C 57,693 59,691 65,689 C 59,687 57,685 55,678 C 53,685 51,687 45,689 C 51,691 53,693 55,700 Z"
          fill="#B8A0C8" opacity="0.48"
        />

        {/* ── SMALL HEART ────────────────────────── */}
        <path
          d="M 128,668 C 120,660 106,651 106,641 C 106,631 116,628 128,640 C 140,628 150,631 150,641 C 150,651 136,660 128,668 Z"
          fill="#C8849A" opacity="0.30"
        />

        {/* ── BOTANICAL LEAF SPRIGS ─────────────── */}

        {/* Sprig 1 — bottom left */}
        <g transform="translate(28,822) rotate(-6)" opacity="0.44" fill="#8FB896">
          <path d="M 0,0 C -5,-24 -3,-50 6,-74" stroke="#8FB896" strokeWidth="1.8" fill="none"/>
          <path d="M -2,-20 C -20,-30 -24,-46 -10,-49 C -4,-36 -2,-26 -2,-20 Z"/>
          <path d="M 3,-22 C 21,-32 25,-48 11,-51 C 5,-38 3,-28 3,-22 Z"/>
          <path d="M -1,-42 C -19,-52 -22,-68 -9,-71 C -3,-58 -1,-48 -1,-42 Z"/>
          <path d="M 4,-44 C 22,-54 24,-70 11,-73 C 5,-60 4,-50 4,-44 Z"/>
          <path d="M 2,-63 C 2,-81 -4,-92 5,-97 C 10,-84 8,-73 2,-63 Z"/>
          <path d="M 6,-65 C 6,-83 12,-94 4,-98 C 9,-85 7,-74 6,-65 Z"/>
        </g>

        {/* Sprig 2 — bottom left, offset */}
        <g transform="translate(68,810) rotate(9)" opacity="0.38" fill="#8FB896">
          <path d="M 0,0 C -3,-20 -1,-40 5,-58" stroke="#8FB896" strokeWidth="1.5" fill="none"/>
          <path d="M -1,-16 C -15,-25 -18,-38 -7,-41 C -2,-30 -1,-21 -1,-16 Z"/>
          <path d="M 2,-18 C 16,-27 19,-40 8,-43 C 3,-32 2,-23 2,-18 Z"/>
          <path d="M 0,-34 C -13,-43 -15,-56 -5,-58 C 0,-47 0,-38 0,-34 Z"/>
          <path d="M 3,-36 C 16,-45 18,-58 7,-60 C 3,-49 3,-40 3,-36 Z"/>
        </g>

        {/* ── SCATTER DOTS ──────────────────────── */}
        <circle cx="192" cy="52"  r="3"   fill="#D4A843" opacity="0.40"/>
        <circle cx="206" cy="44"  r="2"   fill="#D4A843" opacity="0.30"/>
        <circle cx="218" cy="55"  r="1.8" fill="#D4A843" opacity="0.25"/>
        <circle cx="168" cy="345" r="2.5" fill="#8FB896" opacity="0.32"/>
        <circle cx="282" cy="428" r="2"   fill="#C8849A" opacity="0.30"/>
        <circle cx="368" cy="545" r="2"   fill="#7B9BC4" opacity="0.28"/>
        <circle cx="44"  cy="622" r="2"   fill="#D4A843" opacity="0.30"/>
        <circle cx="295" cy="192" r="2.2" fill="#C8849A" opacity="0.28"/>
        <circle cx="22"  cy="390" r="2"   fill="#B8A0C8" opacity="0.28"/>
        <circle cx="375" cy="248" r="2"   fill="#D4A843" opacity="0.28"/>
      </svg>
    </div>
  )
}
