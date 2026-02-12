-- ============================================
-- SEED: Design Formats (standard sizes)
-- Run after the main schema migration
-- ============================================

-- Social Posts
INSERT INTO public.design_formats (name, platform, width, height, unit, category) VALUES
  ('Instagram Post', 'instagram', 1080, 1080, 'px', 'social'),
  ('Instagram Portrait', 'instagram', 1080, 1350, 'px', 'social'),
  ('Instagram Landscape', 'instagram', 1080, 566, 'px', 'social'),
  ('Instagram Story', 'instagram', 1080, 1920, 'px', 'social'),
  ('Instagram Reel Cover', 'instagram', 1080, 1920, 'px', 'video'),
  ('Facebook Post', 'facebook', 1200, 630, 'px', 'social'),
  ('Facebook Cover', 'facebook', 820, 312, 'px', 'social'),
  ('Facebook Story', 'facebook', 1080, 1920, 'px', 'social'),
  ('X / Twitter Post', 'twitter', 1200, 675, 'px', 'social'),
  ('X / Twitter Header', 'twitter', 1500, 500, 'px', 'social'),
  ('LinkedIn Post', 'linkedin', 1200, 627, 'px', 'social'),
  ('LinkedIn Cover', 'linkedin', 1584, 396, 'px', 'social'),
  ('TikTok Video', 'tiktok', 1080, 1920, 'px', 'video'),
  ('YouTube Thumbnail', 'youtube', 1280, 720, 'px', 'video'),
  ('YouTube Channel Art', 'youtube', 2560, 1440, 'px', 'social'),
  ('Pinterest Pin', 'instagram', 1000, 1500, 'px', 'social')
ON CONFLICT DO NOTHING;

-- Ads
INSERT INTO public.design_formats (name, platform, width, height, unit, category) VALUES
  ('Facebook Ad', 'facebook', 1200, 628, 'px', 'ad'),
  ('Instagram Ad Square', 'instagram', 1080, 1080, 'px', 'ad'),
  ('Instagram Ad Story', 'instagram', 1080, 1920, 'px', 'ad'),
  ('Google Display - Medium Rectangle', 'custom', 300, 250, 'px', 'ad'),
  ('Google Display - Leaderboard', 'custom', 728, 90, 'px', 'ad'),
  ('Google Display - Large Rectangle', 'custom', 336, 280, 'px', 'ad'),
  ('Google Display - Half Page', 'custom', 300, 600, 'px', 'ad'),
  ('Google Display - Billboard', 'custom', 970, 250, 'px', 'ad'),
  ('LinkedIn Ad', 'linkedin', 1200, 627, 'px', 'ad')
ON CONFLICT DO NOTHING;

-- Web
INSERT INTO public.design_formats (name, platform, width, height, unit, category) VALUES
  ('Email Header', 'custom', 600, 200, 'px', 'web'),
  ('Newsletter Banner', 'custom', 600, 300, 'px', 'web'),
  ('Website Hero', 'custom', 1440, 600, 'px', 'web'),
  ('Blog Header', 'custom', 1200, 630, 'px', 'web'),
  ('Open Graph Image', 'custom', 1200, 630, 'px', 'web')
ON CONFLICT DO NOTHING;

-- Print
INSERT INTO public.design_formats (name, platform, width, height, unit, category) VALUES
  ('Business Card', 'print', 1050, 600, 'px', 'print'),
  ('Flyer (A5)', 'print', 1748, 2480, 'px', 'print'),
  ('Poster (A3)', 'print', 3508, 4961, 'px', 'print'),
  ('Postcard', 'print', 1800, 1200, 'px', 'print')
ON CONFLICT DO NOTHING;

-- Presentation
INSERT INTO public.design_formats (name, platform, width, height, unit, category) VALUES
  ('Presentation 16:9', 'custom', 1920, 1080, 'px', 'web'),
  ('Presentation 4:3', 'custom', 1024, 768, 'px', 'web')
ON CONFLICT DO NOTHING;


-- ============================================
-- SEED: Starter Templates
-- These are system templates with placeholder canvas_data
-- In production, replace canvas_data with real Fabric.js JSON
-- ============================================

-- Social Post Templates
INSERT INTO public.templates (name, category, format_key, is_system, tags, ai_customization_hints, canvas_data) VALUES
  ('Minimal Product Showcase', 'social_post', 'instagram_post', true,
   '["minimal", "product", "clean"]',
   'Replace the placeholder image with the product. Update headline and CTA text. Apply brand colors to background and text.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#f8f8f8"},{"type":"textbox","left":100,"top":800,"width":880,"text":"YOUR PRODUCT","fontSize":48,"fontWeight":"bold","fill":"#1a1a1a","textAlign":"center"},{"type":"textbox","left":100,"top":880,"width":880,"text":"Shop Now","fontSize":24,"fill":"#666666","textAlign":"center"}]}'),

  ('Bold Sale Announcement', 'social_post', 'instagram_post', true,
   '["sale", "bold", "colorful", "promo"]',
   'Update discount percentage and product name. Swap accent color to brand primary.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#FF3366"},{"type":"textbox","left":80,"top":300,"width":920,"text":"50% OFF","fontSize":120,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":80,"top":500,"width":920,"text":"SUMMER SALE","fontSize":48,"fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":80,"top":600,"width":920,"text":"Limited time only","fontSize":24,"fill":"#FFD4E0","textAlign":"center"}]}'),

  ('Elegant Quote Card', 'social_post', 'instagram_post', true,
   '["quote", "elegant", "typography"]',
   'Replace quote text and attribution. Apply brand fonts.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#1a1a1a"},{"type":"textbox","left":100,"top":350,"width":880,"text":"\"Design is not just what it looks like. Design is how it works.\"","fontSize":36,"fill":"#ffffff","textAlign":"center","fontStyle":"italic"},{"type":"textbox","left":100,"top":700,"width":880,"text":"— Steve Jobs","fontSize":20,"fill":"#888888","textAlign":"center"}]}'),

  ('Gradient Announcement', 'social_post', 'instagram_post', true,
   '["gradient", "modern", "announcement"]',
   'Update headline and subtext. Gradient can be adjusted to brand colors.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1080,"fill":"#667eea"},{"type":"textbox","left":80,"top":400,"width":920,"text":"Something Big\nis Coming","fontSize":64,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":80,"top":650,"width":920,"text":"Stay tuned for the reveal","fontSize":22,"fill":"#d4daff","textAlign":"center"}]}'),

  ('Photo Overlay Banner', 'social_post', 'facebook_post', true,
   '["photo", "overlay", "banner"]',
   'Replace background with product/brand photo. Adjust overlay opacity as needed.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1200,"height":630,"fill":"#333333"},{"type":"rect","left":0,"top":0,"width":1200,"height":630,"fill":"rgba(0,0,0,0.5)"},{"type":"textbox","left":60,"top":220,"width":700,"text":"Your Headline Here","fontSize":48,"fontWeight":"bold","fill":"#ffffff"},{"type":"textbox","left":60,"top":340,"width":700,"text":"Supporting text goes here","fontSize":20,"fill":"#cccccc"}]}'),

  ('Professional LinkedIn Post', 'social_post', 'linkedin_post', true,
   '["professional", "linkedin", "corporate"]',
   'Update headline and stats. Apply brand colors and logo.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1200,"height":627,"fill":"#0A66C2"},{"type":"textbox","left":80,"top":180,"width":1040,"text":"Key Insight","fontSize":56,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":80,"top":320,"width":1040,"text":"Supporting data point or takeaway","fontSize":24,"fill":"#B3D4FC","textAlign":"center"},{"type":"rect","left":400,"top":430,"width":400,"height":60,"rx":30,"fill":"#ffffff"},{"type":"textbox","left":400,"top":445,"width":400,"text":"Learn More","fontSize":20,"fill":"#0A66C2","textAlign":"center"}]}')
ON CONFLICT DO NOTHING;

-- Story Templates
INSERT INTO public.templates (name, category, format_key, is_system, tags, ai_customization_hints, canvas_data) VALUES
  ('Product Story', 'story', 'instagram_story', true,
   '["product", "story", "swipe-up"]',
   'Replace product image area. Update CTA text.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1920,"fill":"#ffffff"},{"type":"rect","left":0,"top":0,"width":1080,"height":1200,"fill":"#f0f0f0"},{"type":"textbox","left":80,"top":1300,"width":920,"text":"Product Name","fontSize":48,"fontWeight":"bold","fill":"#1a1a1a","textAlign":"center"},{"type":"textbox","left":80,"top":1400,"width":920,"text":"$99","fontSize":36,"fill":"#666666","textAlign":"center"},{"type":"textbox","left":80,"top":1700,"width":920,"text":"Swipe Up to Shop","fontSize":20,"fill":"#999999","textAlign":"center"}]}'),

  ('Event Story', 'story', 'instagram_story', true,
   '["event", "story", "countdown"]',
   'Update event name, date, and location.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1080,"height":1920,"fill":"#1a1a2e"},{"type":"textbox","left":80,"top":500,"width":920,"text":"YOU ARE INVITED","fontSize":24,"fill":"#e94560","textAlign":"center","letterSpacing":8},{"type":"textbox","left":80,"top":700,"width":920,"text":"Event Name","fontSize":64,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":80,"top":900,"width":920,"text":"March 15, 2026 | 7:00 PM","fontSize":24,"fill":"#aaaaaa","textAlign":"center"},{"type":"textbox","left":80,"top":1000,"width":920,"text":"123 Venue Street, City","fontSize":20,"fill":"#888888","textAlign":"center"}]}')
ON CONFLICT DO NOTHING;

-- Ad Templates
INSERT INTO public.templates (name, category, format_key, is_system, tags, ai_customization_hints, canvas_data) VALUES
  ('Facebook Ad - Product', 'ad', 'facebook_ad', true,
   '["facebook", "ad", "product", "cta"]',
   'Replace product image, update headline, adjust CTA button color to brand.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1200,"height":628,"fill":"#ffffff"},{"type":"rect","left":0,"top":0,"width":600,"height":628,"fill":"#f5f5f5"},{"type":"textbox","left":640,"top":150,"width":520,"text":"Product Name","fontSize":36,"fontWeight":"bold","fill":"#1a1a1a"},{"type":"textbox","left":640,"top":230,"width":520,"text":"Brief product description that highlights the key benefit.","fontSize":18,"fill":"#666666"},{"type":"rect","left":640,"top":380,"width":200,"height":50,"rx":25,"fill":"#FF3366"},{"type":"textbox","left":640,"top":392,"width":200,"text":"Shop Now","fontSize":18,"fill":"#ffffff","textAlign":"center"}]}'),

  ('Google Display - Medium Rectangle', 'ad', 'google_medium_rect', true,
   '["google", "display", "banner"]',
   'Compact ad format. Keep text minimal. Update CTA and brand colors.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":300,"height":250,"fill":"#ffffff","stroke":"#e0e0e0","strokeWidth":1},{"type":"textbox","left":20,"top":30,"width":260,"text":"Special Offer","fontSize":24,"fontWeight":"bold","fill":"#1a1a1a","textAlign":"center"},{"type":"textbox","left":20,"top":80,"width":260,"text":"Save 25% Today","fontSize":16,"fill":"#666666","textAlign":"center"},{"type":"rect","left":75,"top":180,"width":150,"height":40,"rx":20,"fill":"#0066FF"},{"type":"textbox","left":75,"top":190,"width":150,"text":"Learn More","fontSize":14,"fill":"#ffffff","textAlign":"center"}]}')
ON CONFLICT DO NOTHING;

-- Banner Templates
INSERT INTO public.templates (name, category, format_key, is_system, tags, ai_customization_hints, canvas_data) VALUES
  ('Email Header - Clean', 'email_header', 'email_header', true,
   '["email", "header", "clean", "newsletter"]',
   'Update company name and tagline. Apply brand colors.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":600,"height":200,"fill":"#1a1a1a"},{"type":"textbox","left":30,"top":60,"width":540,"text":"Company Name","fontSize":32,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":30,"top":120,"width":540,"text":"Your weekly update","fontSize":14,"fill":"#aaaaaa","textAlign":"center"}]}'),

  ('Website Hero Banner', 'banner', 'website_hero', true,
   '["hero", "website", "landing"]',
   'Replace background, update headline and CTA. Apply brand fonts and colors.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1440,"height":600,"fill":"#0f172a"},{"type":"textbox","left":120,"top":150,"width":800,"text":"Build Something\nAmazing","fontSize":72,"fontWeight":"bold","fill":"#ffffff"},{"type":"textbox","left":120,"top":380,"width":600,"text":"The platform for modern teams to create, collaborate, and ship.","fontSize":20,"fill":"#94a3b8"},{"type":"rect","left":120,"top":460,"width":180,"height":50,"rx":25,"fill":"#3b82f6"},{"type":"textbox","left":120,"top":473,"width":180,"text":"Get Started","fontSize":16,"fill":"#ffffff","textAlign":"center"}]}')
ON CONFLICT DO NOTHING;

-- Print Templates
INSERT INTO public.templates (name, category, format_key, is_system, tags, ai_customization_hints, canvas_data) VALUES
  ('Business Card - Modern', 'print', 'business_card', true,
   '["business card", "modern", "minimal"]',
   'Update name, title, contact info. Apply brand colors and logo.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1050,"height":600,"fill":"#ffffff"},{"type":"rect","left":0,"top":0,"width":1050,"height":8,"fill":"#1a1a1a"},{"type":"textbox","left":60,"top":180,"width":600,"text":"John Doe","fontSize":32,"fontWeight":"bold","fill":"#1a1a1a"},{"type":"textbox","left":60,"top":240,"width":600,"text":"Creative Director","fontSize":16,"fill":"#666666"},{"type":"textbox","left":60,"top":380,"width":600,"text":"john@company.com | +1 234 567 890","fontSize":12,"fill":"#999999"},{"type":"textbox","left":60,"top":410,"width":600,"text":"www.company.com","fontSize":12,"fill":"#999999"}]}'),

  ('Flyer - Event', 'print', 'flyer_a5', true,
   '["flyer", "event", "print"]',
   'Update event details, date, venue. Apply brand colors for accents.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1748,"height":2480,"fill":"#1a1a2e"},{"type":"textbox","left":120,"top":400,"width":1508,"text":"EVENT\nNAME","fontSize":120,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":120,"top":900,"width":1508,"text":"March 15, 2026","fontSize":36,"fill":"#e94560","textAlign":"center"},{"type":"textbox","left":120,"top":1000,"width":1508,"text":"123 Venue Street, City","fontSize":24,"fill":"#aaaaaa","textAlign":"center"},{"type":"textbox","left":120,"top":1800,"width":1508,"text":"RSVP: event@company.com","fontSize":20,"fill":"#666666","textAlign":"center"}]}')
ON CONFLICT DO NOTHING;

-- Presentation Template
INSERT INTO public.templates (name, category, format_key, is_system, tags, ai_customization_hints, canvas_data) VALUES
  ('Presentation - Title Slide', 'presentation', 'presentation_16_9', true,
   '["presentation", "slide", "title"]',
   'Update title and subtitle. Apply brand colors and fonts.',
   '{"version":"6.0.0","objects":[{"type":"rect","left":0,"top":0,"width":1920,"height":1080,"fill":"#0f172a"},{"type":"textbox","left":160,"top":300,"width":1600,"text":"Presentation Title","fontSize":72,"fontWeight":"bold","fill":"#ffffff","textAlign":"center"},{"type":"textbox","left":160,"top":450,"width":1600,"text":"Subtitle or Date","fontSize":28,"fill":"#64748b","textAlign":"center"},{"type":"rect","left":860,"top":560,"width":200,"height":4,"fill":"#3b82f6"}]}')
ON CONFLICT DO NOTHING;
