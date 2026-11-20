import React from 'react';

const SECTIONS = [
  {
    number: '01.',
    title: 'এই অ্যাপে যা যা Pro ফিচার যুক্ত করা হয়েছে',
    summary:
      'আসল Snapseed এবং প্রফেশনাল ডার্করুমের প্রায় সব মূল ইঞ্জিন ও ইউটিলিটি এখন সম্পূর্ণ ব্রাউজারেই লাইভ চলছে:',
    points: [
      {
        label: '২৮টি পূর্ণাঙ্গ Darkroom ও Retouch টুল',
        detail:
          'Remini-স্টাইল HD Enhance (2x Upscale, Denoise & Face/Eye Detail), Pro Object Remover (PatchMatch Inpainting), Tune Image, Details, Curves, White Balance (Eyedropper), Aspect-Locked Crop & Rotate, Perspective Tilt, Expand Canvas, Edge-Aware Selective U-Point, Brush (Opacity & Hardness), Healing Spot, Face-Aware Portrait, Lens Blur, HDR Scape, Tonal Contrast, Glamour Glow, Drama, Vintage, Retrolux, Noir, B&W, Grain, 3D LUT (.cube ইম্পোর্ট ও ৪টি সিনেমা LUT), Double Exposure, Vignette, Text ও Frames।',
      },
      {
        label: 'Web Worker OffscreenCanvas ও Batch Export',
        detail:
          'ফুল-রেজোলিউশন এবং একাধিক ছবি একসাথে Batch Export এখন ব্যাকগ্রাউন্ড Web Worker-এ রেন্ডার হয় (UI ফ্রিজ ছাড়াই), সাথে লাইভ Export File Size প্রিভিউ (MB/KB)।',
      },
      {
        label: 'RAW (.DNG / .TIFF) প্রিভিউ ও Histogram Clipping',
        detail:
          'ক্যামেরা .DNG / .TIFF ফাইল ড্র্যাগ-ড্রপ করলেই ভেতরের ফুল-রেজ ছবি ও EXIF পড়ে নেয়। J বা Histogram বাটনে ক্লিক করলে Shadow (Blue) ও Highlight (Red) Clipping Warning দেখা যায়।',
      },
      {
        label: 'QR Code Look Sharing, Pinch-Zoom ও Auto-Save',
        detail:
          'যেকোনো Edit Stack-কে QR কোড বা Look Code দিয়ে শেয়ার ও ইমপোর্ট করা যায়। মোবাইল ও ডেস্কটপে Two-Finger Pinch-to-Zoom, Ctrl+Z Undo/Redo এবং IndexedDB Auto-Save যুক্ত রয়েছে।',
      },
    ],
  },
  {
    number: '02.',
    title: 'Play Store / App Store-এর জন্য Mobile Production Architecture',
    summary:
      'ভবিষ্যতে যদি নেটিভ মোবাইল অ্যাপ (Google Play / App Store) হিসেবে রিলিজ করতে চান, তাহলে নিচের টেক-স্ট্যাক ব্যবহার করতে পারেন:',
    points: [
      {
        label: 'Android Native (সবচেয়ে শক্তিশালী)',
        detail:
          'Kotlin + Jetpack Compose + OpenGL ES 3.0 / Vulkan অথবা AGSL Shaders। পূর্ণ ১৬-বিট RAW (DNG) ডেমোসাইকিংয়ের জন্য C++ NDK-তে LibRaw যুক্ত করুন।',
      },
      {
        label: 'iOS Native',
        detail:
          'Swift + SwiftUI + Metal Shaders + Core Image (CIRAWFilter)। এতে 16-bit ফ্লোটিং-পয়েন্ট কালার গ্রেডিং কোনো Banding ছাড়াই পাওয়া যায়।',
      },
      {
        label: 'Cross-Platform (Android + iOS)',
        detail:
          'Flutter + Impeller Fragment Shaders অথবা React Native + react-native-skia দিয়ে একসাথে দুটি প্ল্যাটফর্মে GPU-accelerated এডিটর তৈরি করা সম্ভব।',
      },
      {
        label: 'অন-ডিভাইস ML Portrait Segmentation',
        detail:
          'নেটিভ অ্যাপে Google ML Kit Subject Segmentation অথবা Apple Vision যুক্ত করলে চুলের কিনারা পর্যন্ত সাবজেক্ট ও ব্যাকগ্রাউন্ড অটো-মাস্কিং পাওয়া যাবে।',
      },
    ],
  },
];

export const BlueprintView: React.FC = () => {
  return (
    <div className="flex-1 overflow-y-auto darkroom-scroll p-6 md:p-10 max-w-[1040px] mx-auto w-full">
      <div className="border-b border-[#222228] pb-6 mb-8">
        <p className="text-xs font-medium text-[#22C55E] mb-2">
          Chitro Pro Architecture &amp; Build Guide
        </p>
        <h1 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-[#F4F4F6]">
          Snapseed-গ্রেড প্রো ডার্করুম আর্কিটেকচার ও ফিচার গাইড
        </h1>
        <p className="text-sm md:text-base text-[#A1A1AA] mt-2.5 max-w-2xl leading-relaxed">
          এই প্রো স্টুডিওতে ২৬টি টুল, Web Worker ব্যাকগ্রাউন্ড রেন্ডারিং, .DNG RAW ডিকোডার, .cube 3D LUT,
          Batch Export, QR Look Sharing, Pinch-to-Zoom এবং Clipping Warning যুক্ত করা হয়েছে।
        </p>
      </div>

      <div className="space-y-8">
        {SECTIONS.map((sec) => (
          <section
            key={sec.number}
            className="border border-[#222228] bg-[#111115] rounded-lg p-6"
          >
            <div className="flex items-baseline gap-3 mb-2">
              <span className="font-mono text-sm font-medium text-[#22C55E]">
                {sec.number}
              </span>
              <h2 className="font-display text-lg font-semibold text-[#F4F4F6]">
                {sec.title}
              </h2>
            </div>
            <p className="text-sm text-[#A1A1AA] mb-5 leading-relaxed">
              {sec.summary}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sec.points.map((pt) => (
                <div
                  key={pt.label}
                  className="bg-[#16161B] border border-[#23232A] rounded-md p-4"
                >
                  <h3 className="text-sm font-semibold text-[#F4F4F6] mb-1.5">
                    {pt.label}
                  </h3>
                  <p className="text-xs text-[#9E9EA9] leading-relaxed">
                    {pt.detail}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};
