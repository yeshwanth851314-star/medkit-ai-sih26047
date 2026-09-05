# MedKit AI — UI/UX Brief

**Version:** 1.0  
**Design goal:** clinical-grade clarity with high demo impact, without "AI slop."

---

## 1. UX North Star

The interface should feel like a **calm clinical instrument**, not a flashy AI chatbot.

Primary qualities:
- trustworthy
- fast
- legible
- accessible
- low cognitive load
- obvious system state
- clinician-controlled
- tablet/kiosk friendly

## 2. Visual Direction

### Tone
- Modern healthcare.
- Professional.
- Warm enough for patients.
- Dense enough for clinicians.
- Restrained use of animation.

### Avoid
- neon gradients everywhere
- glassmorphism overload
- giant AI robot imagery
- decorative dashboards
- excessive rounded cards
- fake medical "precision"
- excessive charts

### Signature visual
The Clinical Timeline should be the product's visual identity.

## 3. Information Hierarchy

Every page must answer:
1. Where am I?
2. What is the current patient/case?
3. What do I need to do next?
4. What happened?
5. What requires attention?

## 4. Layout

Desktop:
```text
┌──────────────┬────────────────────────────────────┐
│ Navigation   │ Page header                        │
│              ├────────────────────────────────────┤
│ Dashboard    │ Primary work area                  │
│ Patients     │                                    │
│ Cases        │                                    │
│ Settings     │                                    │
└──────────────┴────────────────────────────────────┘
```

Patient intake:
```text
┌────────────────────────────────────────────────────┐
│ Patient • Language • Consent • Progress           │
├───────────────────────┬────────────────────────────┤
│ Question              │ Captured answer            │
│                       │                            │
│                       │ [Speak] [Tap] [Type]      │
│                       │                            │
│                       │ Source / confidence        │
└───────────────────────┴────────────────────────────┘
```

Clinician case:
```text
┌───────────────┬────────────────────────────────────┐
│ Patient       │ Current case                        │
│ identity      │                                    │
│ timeline      │ Summary | History | Docs | Flags   │
│               │                                    │
│               │ Structured clinical content        │
└───────────────┴────────────────────────────────────┘
```

## 5. Accessibility

Minimum:
- WCAG-oriented semantic HTML.
- Keyboard navigation.
- Visible focus.
- Accessible labels.
- Screen-reader-friendly status messages.
- Contrast target ≥4.5:1 for normal text.
- Do not communicate meaning by color alone.
- Large touch targets for kiosk/tablet.
- Voice and touch alternatives.

Use the Antigravity accessibility and Impeccable skills for audits and polish.

## 6. Typography

Use one primary UI family plus optional localized fallback fonts.

Guidelines:
- body line length approximately 65–75 characters.
- strong heading hierarchy.
- minimum readable body size.
- avoid all-caps for long clinical content.
- numbers should align clearly in vital-sign displays.

## 7. Navigation

Doctor navigation:
- Dashboard
- Patients
- Cases
- Timeline
- Settings

Patient/kiosk:
- no complex persistent navigation
- clear Back / Next / Repeat / Help
- always show progress

## 8. Dashboard

### Primary content
- Search patient.
- Register patient.
- Today's intake queue.
- Draft cases.
- Cases requiring review.

### Secondary
- Recent activity.
- System status.

Do not make analytics the center of the MVP.

## 9. Patient Profile

Header:
- patient code
- name
- age/DOB
- relevant safe demographics

Tabs:
- Overview
- Timeline
- Current Case
- Documents
- Medications/Allergies

## 10. Case Form

Use sections rather than one giant form.

Recommended:
1. Chief Complaint
2. HPI
3. Past History
4. Family/Personal
5. Medications/Allergies
6. Examination
7. Assessment/Plan
8. Review

Always expose:
- Save Draft
- progress
- validation
- last saved state

## 11. Patient Interview

Question card:

```text
What is bothering you today?

[ 🎙 Speak ]
[ Choose an answer ]
[ Type instead ]

You can answer in your selected language.
```

For low-literacy users:
- audio playback
- simple language
- icon support
- repeat question
- assisted mode

## 12. AI Transparency

AI-assisted areas need explicit labels.

Example:

```text
AI-ASSISTED SUMMARY
Generated from verified case information.

[Review sources] [Edit] [Confirm]
```

Avoid:
- "100% accurate"
- "AI diagnosis"
- unexplained confidence scores

## 13. OCR Review

Use side-by-side when screen size permits:

```text
Original document       Extracted information
──────────────────      ─────────────────────
[document preview]      Medicine: ...
                        Dose: ...
                        Date: ...
                        Confidence: 94%
                        Source: Page 1

                        [Verify]
```

## 14. Red Flag Component

The red-flag component must be visually distinct but not alarmist.

Content:
- potential red flag
- reason at a high level
- action: alert clinical staff
- acknowledgement state

No diagnosis language.

## 15. Timeline

Timeline card:

```text
● 06 Sep 2026 — Current Visit
  Chest discomfort • 3 days
  New medication recorded
  1 document added
  1 potential red flag acknowledged

│
● 12 Aug 2026 — Previous Visit
  Similar complaint
  Medication A
```

Add:
**Compare with previous visit**

## 16. Empty States

Useful, not decorative.

Bad:
> Nothing here!

Good:
> No previous visits yet. Start the first case to create this patient's clinical timeline.

## 17. Error States

Bad:
> Something went wrong.

Good:
> We couldn't generate the summary. Your case is saved. You can retry or continue manually.

## 18. Loading States

Use:
- skeletons for page data
- progress for OCR
- waveform/recording indicator for voice
- step progress for AI operations

Never fake progress percentages.

## 19. Microinteractions

Use animation only when it communicates:
- recording
- processing
- saved
- alert
- transition

Keep motion short and respect reduced-motion preferences.

## 20. Responsive / Kiosk

Breakpoints must support:
- desktop clinician monitor
- laptop
- tablet
- kiosk-like touchscreen

Critical patient controls must remain reachable without precision mouse use.

## 21. Design QA Checklist

Before a screen is marked done:
- hierarchy is clear
- primary action is obvious
- loading exists
- empty state exists
- error state exists
- success state exists
- keyboard navigation works
- contrast passes
- mobile/tablet layout works
- no accidental PHI exposure
- no console errors
- no unnecessary animation

## 22. Impeccable Pass

After functional implementation, run:
1. critique
2. accessibility audit
3. responsive audit
4. consistency audit
5. performance audit
6. polish
7. harden

Do not allow visual polish to destabilize working clinical flows.
