"""Generate a backend-free screen inventory and raw HTML frontend skeletons."""
from pathlib import Path
import html
import json
import re
import shutil

ROOT = Path(__file__).parent
SCREENS = []


def node(kind, text='', children=None, **props):
    return dict(kind=kind, text=text, children=children or [], **props)


def text(value, style='body'): return node('text', value, style=style)
def title(value): return text(value, 'title')
def row(*children): return node('row', children=list(children))
def col(*children): return node('column', children=list(children))
def button(label, to=None, variant='primary', **props): return node('button', label, to=to, variant=variant, **props)
def field(label, placeholder='', type='text'): return node('field', label, placeholder=placeholder, inputType=type)
def badge(label, variant='muted'): return node('badge', label, variant=variant)
def card(label, *children, variant='solid'): return node('card', label, list(children), variant=variant)
def image(label='Event photograph', height=140): return node('image', label, height=height)
def chips(*labels): return node('chips', children=[badge(x) for x in labels])
def stat(label, value): return node('stat', value, label=label)
def table(headers, rows): return node('table', headers=headers, rows=rows)
def check(label): return node('check', label)
def note(label): return text(label, 'muted')
def actions(*items): return row(*[button(label, dest, 'outline') for label, dest in items])


def screen(id, name, platform, *children, status='current', source='', shell='main', section='', back=None, notes=''):
    SCREENS.append(dict(id=id, name=name, platform=platform, status=status,
                        source=source, shell=shell, section=section or ('Current UI' if status != 'planned' else 'Planned wireframes'),
                        back=back, notes=notes, children=list(children)))


def mobile(id, name, *children, **props): screen('m-'+id, name, 'mobile', *children, **props)
def admin(id, name, *children, **props): screen('a-'+id, name, 'admin', *children, **props)


def build_inventory():
    mobile('login', 'Login', row(text('BGSC', 'heading')), chips('Login', 'Register'),
           field('EMAIL OR USERNAME', 'example@email.com'), field('PASSWORD', '••••••••', 'password'),
           row(check('Remember me'), button('Forgot password?', 'm-forgot', 'ghost')),
           button('Sign in', 'm-home'), note('or continue with'), button('Continue with Google', 'm-unavailable', 'outline'),
           button('Create an account', 'm-register', 'ghost'), shell='auth', source='mobile/screens/login/login.tsx')
    mobile('register', 'Create account', text('BGSC', 'heading'), chips('Login', 'Register'),
           field('FULL NAME', 'Your full name'), field('USERNAME', 'Choose a username'), field('EMAIL', 'example@email.com'),
           field('PASSWORD', 'At least 8 characters', 'password'), field('REPEAT PASSWORD', 'Repeat password', 'password'), field('CONTACT', '+91'),
           check('I agree to the Terms of Service and Privacy Policy'), actions(('Terms', 'm-terms'), ('Privacy', 'm-privacy')),
           button('Create account', 'm-home'), button('Continue with Google', 'm-unavailable', 'outline'), button('Back to login', 'm-login', 'ghost'),
           shell='auth', source='mobile/screens/login/register.tsx')
    mobile('forgot', 'Reset your password', title('Reset your password'), note('We will send a reset link to your registered email.'),
           field('EMAIL', 'example@email.com'), button('Send reset link', 'm-reset-sent'), button('Back to login', 'm-login', 'outline'),
           shell='auth', source='mobile/screens/login/forgot-password.tsx')
    mobile('reset-sent', 'Reset link requested', title('Check your inbox'),
           note('If an account exists for your email, a reset link is on its way.'), button('Back to login', 'm-login', 'outline'),
           shell='auth', source='mobile/screens/login/forgot-password.tsx', section='Current states')
    mobile('otp', 'OTP (obsolete route)', title('Verification Code'), note('We have sent the verification code to your email address'),
           row(field('1', '0'), field('2', '0'), field('3', '0'), field('4', '0')), button('Continue', 'm-unavailable'),
           shell='auth', status='dormant', source='mobile/screens/login/otp.tsx', notes='Present in source; current registration does not navigate here.')
    mobile('complete-profile', 'Complete profile (dormant)', title('Complete your profile'),
           field('PASSWORD', 'Password', 'password'), field('REPEAT PASSWORD', 'Password', 'password'), field('CONTACT', '+91'),
           check('I agree to the terms'), button('Finish', 'm-home'), shell='auth', status='dormant',
           source='mobile/screens/login/complete-profile.tsx', notes='Present in source; mobile Google sign-in is unavailable.')
    mobile('home', 'Home', title('Dashboard'), note('Your campus activity at a glance.'),
           card('Season Points', badge('Active', 'success'), card('', text('1,250', 'hero'), note('Points earned this season'),
                row(stat('Events', '12'), stat('Rank', '#8')), variant='inner'), button('View Leaderboard', 'm-leaderboard')),
           text('Upcoming Events', 'heading'), card('Football Championship', badge('Open'), note('Saturday, 10:00 AM'),
                text('Main ground · 16 teams · Register before Friday midnight'), button('Register Now', 'm-events')),
           card('BGEC Esports Tournament', badge('Soon'), note('Next Wednesday, 6:00 PM'), text('Student activity centre · Valorant · 32 player slots'), button('View Details', 'm-events', 'outline')),
           text('Quick Actions', 'heading'), row(card('Challenges', text('5 active')), card('Rewards', text('3 pending'))),
           status='demo', source='mobile/screens/drawer/home.tsx', notes='Cards and stats are static; challenge/reward tiles have no source action.')
    mobile('events', 'Events', field('SEARCH', 'Search events'), chips('All', 'Leagues', 'BGEC', 'FitSoc', 'General'),
           chips('Upcoming & live', 'Happening now', 'Past events'), text('Upcoming', 'heading'),
           card('Football Championship', badge('Open', 'success'), note('Sat, 10:00 AM · Main ground'), text('Leagues · Team event · 16 teams'), button('Register', 'm-event-detail')),
           card('BGSC Cricket League', badge('Auction live', 'success'), note('Sat, 8:00 AM · Cricket ground'), text('Leagues · Auction league'), button('Watch auction', 'm-auction', 'outline')),
           source='mobile/screens/drawer/events.tsx')
    mobile('event-detail', 'Event details', image('Event cover — runtime asset'), badge('Open', 'success'), title('Football Championship'),
           note('Saturday, 10:00 AM · Main ground'), row(button('Photo 1', 'm-viewer', 'outline'), button('Photo 2', 'm-viewer', 'outline')),
           card('About this event', text('A campus team championship with group matches and a knockout final.'), chips('League', 'Team event'),
                text('Format: League · Team event'), text('Capacity: 16 teams'), text('Team size: 5–11 players'), note('Registration closes Friday midnight'), actions(('Read event rules', 'm-terms'), ('Rulebook PDF', 'm-rules-pdf'))),
           card('Your registration', badge('Required', 'warning'), text('Reserve your place by completing the registration form.'), button('Register now', 'm-registration'), variant='accent'),
           card('Standings', note('Live rankings for this event'), button('View standings', 'm-event-leaderboard', 'outline')),
           card('Awards', text('#1 Champions'), text('#2 Runners-up')), card('Contacts', text('Sports coordinator'), button('Contact organiser', 'm-organiser', 'outline')),
           source='mobile/screens/events/event-details.tsx', shell='detail', back='m-events')
    mobile('registration', 'Event registration', title('Football Championship'), note('Join an existing team or register a new team as captain.'),
           card('Your team', field('REGISTRATION ROLE', 'Team member / Team captain', 'select'), field('TEAM (OPTIONAL)', 'Choose an open team', 'select')),
           card('Registration form', field('FULL NAME *', 'Your full name'), field('EMAIL *', 'Your university email'), field('PLAYING POSITION', 'Choose position', 'select'), check('Available for all fixtures'), button('Upload image', 'm-upload-dialog', 'outline')),
           card('', check('I agree to the event rules and attendance policy'), button('Read the rules', 'm-terms', 'ghost')),
           button('Review & submit', 'm-registration-review'), button('Cancel', 'm-event-detail', 'ghost'),
           source='mobile/screens/events/registration.tsx', shell='detail', back='m-event-detail')
    mobile('registration-captain', 'Registration • captain', title('Football Championship'), card('Your team', field('REGISTRATION ROLE', 'Team captain', 'select'), field('NEW TEAM NAME', 'Enter a team name'), note('Your captain application will be reviewed by the organisers.')),
           card('Registration form', field('FULL NAME *', 'Your name'), field('EMAIL *', 'Your email')), check('I agree to the event rules'),
           button('Review & submit', 'm-registration-review'), source='mobile/screens/events/registration.tsx', section='Current states', shell='detail', back='m-registration')
    mobile('registered', 'Event details • registered', title('Football Championship'), card('Your registration', badge('Confirmed', 'success'), text('You are on the participant list.'), button('Cancel registration', 'm-cancel-registration', 'danger'), variant='accent'),
           card('Standings', button('View standings', 'm-event-leaderboard', 'outline')), button('Back to events', 'm-events', 'outline'),
           source='mobile/screens/events/event-details.tsx', section='Current states', shell='detail', back='m-events')
    mobile('auction', 'Live auction', badge('Live now', 'success'), title('BGSC Cricket League'), note('Approved captains draft registered players.'),
           actions(('Live', 'm-auction'), ('Players', 'm-auction-players'), ('My bids', 'm-my-bids')),
           card('Currently on the block', text('5s', 'mono'), row(node('avatar', 'JP'), col(text('Jeet Patel', 'heading'), note('Lot #4 · Base price 100 credits'))),
                note('CURRENT BID'), text('350 credits', 'hero'), text('North Stars'), variant='accent'),
           card('Place a bid', note('650 credits left · 4/11 players'), row(button('−', variant='outline'), text('400', 'heading'), button('+', variant='outline')),
                chips('+50', '+100', '+250'), button('Bid 400 credits', 'm-bid-confirm')),
           card('Live bid log', row(text('North Stars'), text('350 credits', 'mono')), row(text('Campus United'), text('300 credits', 'mono'))),
           card('Team purses', row(text('North Stars'), text('650 credits left')), node('progress', value=0.35), row(text('Campus United'), text('700 credits left'))),
           source='mobile/screens/events/auction.tsx', shell='detail', back='m-event-detail', notes='Sample captain view; spectator variant hides bid controls and My bids.')
    mobile('auction-players', 'Auction • players', actions(('Live', 'm-auction'), ('Players', 'm-auction-players'), ('My bids', 'm-my-bids')),
           card('Auction pool', row(text('#1 Aarav Sharma'), badge('Sold', 'success')), button('View bid history', 'm-bid-history', 'outline'),
                row(text('#2 Jeet Patel'), badge('On the block')), button('View player bids', 'm-bid-history', 'outline')),
           source='mobile/screens/events/auction.tsx', section='Current states', shell='detail', back='m-auction')
    mobile('my-bids', 'Auction • my bids', actions(('Live', 'm-auction'), ('Players', 'm-auction-players'), ('My bids', 'm-my-bids')),
           card('My bids', row(text('Jeet Patel'), text('350 credits', 'mono')), badge('Leading', 'success'), row(text('Aarav Sharma'), text('200 credits', 'mono')), badge('Outbid')),
           source='mobile/screens/events/auction.tsx', section='Current states', shell='detail', back='m-auction')
    mobile('auction-result', 'Auction • result', title('SOLD!'), card('Previous lot', text('Jeet Patel', 'heading'), text('North Stars · 400 credits'), badge('Sold', 'success'), variant='accent'), button('Continue watching', 'm-auction'),
           source='mobile/screens/events/auction.tsx', section='Current states', shell='detail', back='m-auction')
    mobile('leaderboard', 'Leaderboard', actions(('Global', 'm-leaderboard'), ('Events', 'm-leaderboard-events'), ('Challenges', 'm-leaderboard-challenges')),
           note('Season rankings across all activities.'), chips('All time', 'Semester', 'This month', 'This week'), chips('All', 'Sports', 'Esports', 'Fitness', 'Dev'),
           card('Your position', badge('Top 10%', 'success'), text('#8', 'hero'), note('1,250 total points'), button('Scroll to my position', 'm-leaderboard-self', 'outline'), variant='accent'),
           row(stat('2 · Meera Das', '2,120'), stat('1 · Aarav Sharma', '2,480'), stat('3 · Riya Kapoor', '1,970')),
           card('Rankings', row(text('#4 Campus member'), text('1,850', 'mono')), row(text('#5 Campus member'), text('1,700', 'mono'))), source='mobile/screens/drawer/leaderboard.tsx')
    mobile('leaderboard-events', 'Leaderboard • events', actions(('Global', 'm-leaderboard'), ('Events', 'm-leaderboard-events'), ('Challenges', 'm-leaderboard-challenges')),
           card('Football Championship', note('League · Saturday'), badge('Live', 'success'), button('View standings', 'm-event-leaderboard', 'outline')),
           source='mobile/screens/drawer/leaderboard.tsx', section='Current states')
    mobile('leaderboard-challenges', 'Leaderboard • challenges', actions(('Global', 'm-leaderboard'), ('Events', 'm-leaderboard-events'), ('Challenges', 'm-leaderboard-challenges')),
           chips('All time', 'Semester', 'This month', 'This week'), card('Challenge points', text('Points earned from challenges.'), row(text('#1 Aarav Sharma'), text('600 pts', 'mono')), row(text('#2 Meera Das'), text('450 pts', 'mono'))),
           source='mobile/screens/drawer/leaderboard.tsx', section='Current states')
    mobile('leaderboard-self', 'Leaderboard • your row', card('Your position', text('#8 · Jeet Patel', 'heading'), text('1,250 points'), variant='accent'), button('Back to podium', 'm-leaderboard', 'outline'),
           source='mobile/screens/drawer/leaderboard.tsx', section='Current states')
    mobile('event-leaderboard', 'Event standings', title('Football Championship'), chips('Round robin', '16 entries'), card('Your team', text('North Stars', 'heading'), text('#3', 'hero'), note('420 points'), variant='accent'),
           field('SEARCH', 'Search participants'), row(stat('2 · Campus United', '450'), stat('1 · Orange Eleven', '500'), stat('3 · North Stars', '420')),
           card('Standings', row(text('#4 South Stars'), text('390 pts'))), source='mobile/screens/events/event-leaderboard.tsx', shell='detail', back='m-leaderboard-events')
    mobile('profile', 'Profile', node('avatar', 'J'), title('Jeet'), note('jeet@example.com'), badge('Member'),
           card('Player Stats', row(stat('Total Points', '1,250'), stat('Events Joined', '12'), stat('Rank', '#8')), variant='accent'),
           card('Recent Events', text('Football Championship'), note('Completed · +150 pts'), text('Coding Workshop'), note('Completed · +100 pts'), text('Cricket League'), note('Registered'), button('View all history', 'm-history', 'outline')),
           button('Account Settings', 'm-edit-profile', 'outline'), button('Help & Support', 'm-edit-profile', 'outline'), button('Logout', 'm-logout', 'danger'),
           status='demo', shell='profile', source='mobile/screens/drawer/profile.tsx')
    mobile('edit-profile', 'Edit profile', note('Keep your player card up to date.'), card('', field('USERNAME', 'Jeet'), field('EMAIL', 'jeet@example.com'), field('CONTACT', '+91 98765 43210'), field('FAVOURITE SPORT', 'Football', 'select')),
           button('Save changes', 'm-profile-saved'), status='demo', source='mobile/screens/profile/edit-profile.tsx', shell='detail', back='m-profile')
    mobile('history', 'Event history', note('Your participation and points from past events.'), card('Football Championship', note('Completed · May 2026'), badge('+150 pts', 'success')),
           card('Coding Workshop', note('Completed · April 2026'), badge('+100 pts', 'success')), card('Cricket League', note('Registered · March 2026'), badge('Upcoming')),
           note('Mock history will sync with your account when the service is connected.'), status='demo', source='mobile/screens/profile/history.tsx', shell='detail', back='m-profile')
    mobile('announcements', 'Announcements', text('Latest updates', 'heading'), card('Season registration is open', badge('New'), note('Today · BGSC Admin'), text("Register for this season’s tournaments before Sunday midnight.")),
           card('Points system updated', note('Yesterday · BGSC Admin'), text('Participation and volunteering points are now visible in your profile.')),
           status='demo', source='mobile/screens/drawer/announcement.tsx')
    mobile('hall-of-fame', 'Hall of Fame', note('Celebrating the people who define BGSC.'), text('Featured', 'heading'),
           card('Athlete of the month', badge('2026'), row(node('avatar', 'RK'), text('Riya Kapoor', 'heading')), text('Basketball · 3 tournament wins'), button('View honour', 'm-hof-detail', 'outline'), variant='accent'),
           field('SEARCH', 'Search by name or title'), chips('All', 'Sports', 'Esports', 'Community'), actions(('List', 'm-hall-of-fame'), ('Timeline', 'm-hof-timeline')),
           card('Community champion', text('Meera Das', 'heading'), badge('+200 pts', 'success'), button('View honour', 'm-hof-detail', 'outline')),
           source='mobile/screens/drawer/hall-of-fame.tsx')
    mobile('hof-timeline', 'Hall of Fame • timeline', chips('All', 'Sports', 'Community'), actions(('List', 'm-hall-of-fame'), ('Timeline', 'm-hof-timeline')),
           text('2026', 'heading'), card('Athlete of the month', text('Riya Kapoor'), button('Open honour', 'm-hof-detail', 'outline')), text('2025', 'heading'), card('Community champion', text('Meera Das'), button('Open honour', 'm-hof-detail', 'outline')),
           source='mobile/screens/drawer/hall-of-fame.tsx', section='Current states')
    mobile('hof-detail', 'Hall of Fame • honour', image('Honour cover — runtime asset'), chips('Sports', '2026'), title('Athlete of the month'), row(node('avatar', 'RK'), col(text('Riya Kapoor', 'heading'), note('Member · Inducted 2026'))),
           card('The story', text('Recognising outstanding contribution to BGSC sport and community.')), card('Achievements', chips('Year 2026', 'Sports', '+200 points')),
           card('Roster', row(node('avatar', 'RK'), text('Riya Kapoor'))), button('View event', 'm-event-detail', 'outline'), button('Share', 'm-share'),
           source='mobile/screens/hall-of-fame/hall-of-fame-detail.tsx', shell='detail', back='m-hall-of-fame')
    mobile('media', 'Media', note('Photos and videos from BGSC events and the community.'), chips('All', 'Photos', 'Videos'), chips('Everything', 'Events', 'Community', 'Memories'),
           button('Share a photo or video', 'm-upload-dialog', 'outline'), text('Gallery', 'heading'),
           row(button('Photo 1', 'm-viewer', 'tile'), button('Photo 2', 'm-viewer', 'tile'), button('Video', 'm-video', 'tile')),
           row(button('Photo 3', 'm-viewer', 'tile'), button('Photo 4', 'm-viewer', 'tile'), button('Photo 5', 'm-viewer', 'tile')),
           source='mobile/screens/drawer/media.tsx')
    mobile('viewer', 'Media viewer', image('Photo — runtime asset', 460), row(button('Previous', 'm-viewer', 'outline'), note('1 / 6'), button('Next', 'm-video', 'outline')),
           text('Football Championship'), note('BGSC member · October 2026'), actions(('Like · 12', 'm-viewer'), ('Share', 'm-share')), source='mobile/screens/media/media-viewer.tsx', shell='detail', back='m-media')
    mobile('video', 'Media viewer • video', image('Video playback — native controls', 460), actions(('Play / pause', 'm-video'), ('Previous', 'm-viewer'), ('Share', 'm-share')),
           source='mobile/screens/media/media-viewer.tsx', section='Current states', shell='detail', back='m-media')
    mobile('feedback', 'Feedback', note('Help us make the BGSC experience better.'), card('Your feedback matters', text('Tell us what worked and what we can improve.')),
           card('What is this about?', field('CATEGORY', 'App experience / Event / Something else', 'select'), field('YOUR MESSAGE', 'Write your feedback…', 'textarea'), button('Send feedback', variant='primary')),
           status='demo', source='mobile/screens/drawer/feedback.tsx', notes='The source Send handler is empty; this current-state button intentionally has no destination.')
    # Explicit current navigation and overlay states.
    mobile('drawer', 'Navigation drawer', *[button(label, dest, 'ghost', icon=icon) for label,dest,icon in [
        ('Home','m-home','home'),('Announcements','m-announcements','megaphone-outline'),('Hall of Fame','m-hall-of-fame','star-outline'),('Media','m-media','images-outline'),('Feedback','m-feedback','chatbox-outline'),('Logout','m-logout','log-out-outline')]],
        shell='overlay', source='mobile/screens/drawer/layout.tsx', section='Current overlays', back='m-home')
    mobile('notifications', 'Notifications', actions(('Mark all read', 'm-notifications'), ('Close', 'm-home')), card('New Event: Football Championship', note('Registration is now open. · Just now')), card('Points earned', note('Your activity points were updated. · 1h ago')),
           shell='overlay', source='mobile/src/components/AppHeader.tsx', section='Current overlays', back='m-home', notes='Source notification press marks read and closes; it does not navigate to an event.')
    overlays=[
        ('registration-review','Review registration','Football Championship · Team member',[text('Review your details before submitting.'),button('Confirm registration','m-registration-result'),button('Back','m-registration','ghost')],'mobile/src/popups/EventRegistrationPopup.tsx'),
        ('registration-result','Registration submitted','Your place or approval status is shown here.',[badge('Confirmed','success'),button('Done','m-registered')],'mobile/screens/events/registration.tsx'),
        ('terms','Event rules','Read the event rules and attendance policy.',[text('Rules supplied for this event appear in a scrollable column.'),check('I have read and agree to these rules'),button('Accept','m-registration'),button('Close','m-event-detail','ghost')],'mobile/src/popups/TermsPopup.tsx'),
        ('privacy','Privacy Policy','University credentials and match data remain within the campus community.',[button('Understood','m-register')],'mobile/screens/login/register.tsx'),
        ('bid-confirm','Confirm bid','Jeet Patel',[text('400 credits','hero'),note('Budget after this bid: 250 credits'),note('Time left: 5s'),button('Place bid','m-auction-result'),button('Cancel','m-auction','ghost')],'mobile/src/popups/BidConfirmPopup.tsx'),
        ('bid-history','Player bid history','Jeet Patel · 2 bids',[text('North Stars · 350 credits'),text('Campus United · 300 credits'),button('Close','m-auction-players','outline')],'mobile/screens/events/auction.tsx'),
        ('logout','Log out?','You will need to sign in again to register or bid.',[button('Log out','m-login','danger'),button('Cancel','m-profile','ghost')],'mobile/src/hooks/useConfirmLogout.ts'),
        ('cancel-registration','Cancel registration?','You will lose your place in Football Championship.',[button('Cancel registration','m-event-detail','danger'),button('Keep my place','m-registered','ghost')],'mobile/screens/events/event-details.tsx'),
        ('upload-dialog','Share with BGSC?','Your photo or video will be reviewed before appearing.',[button('Choose file','m-upload-dialog','outline'),button('Upload','m-upload-success'),button('Cancel','m-media','ghost')],'mobile/screens/drawer/media.tsx'),
        ('upload-success','Upload received','Thanks for sharing. It will appear once approved.',[button('Done','m-media')],'mobile/src/popups/PopupProvider.tsx'),
        ('profile-saved','Profile saved','Your profile changes are saved locally for this demo.',[button('Done','m-profile')],'mobile/screens/profile/edit-profile.tsx'),
        ('unavailable','Not available yet','Google sign-in is not available in mobile. Please use email and password.',[button('OK','m-login')],'mobile/src/repositories/AuthRepository.ts'),
        ('error','Something went wrong','Check the highlighted fields or try again.',[button('Try again','m-events'),button('Close','m-home','ghost')],'mobile/src/popups/PopupProvider.tsx'),
        ('info','Information','A reusable information message.',[button('Got it','m-home')],'mobile/src/popups/PopupProvider.tsx'),
        ('warning','Check your details','Some required fields are missing or invalid.',[button('OK','m-registration')],'mobile/src/popups/PopupProvider.tsx'),
    ]
    for id,name,message,children,src in overlays:
        mobile(id,name,title(name),note(message),*children,shell='overlay',section='Current overlays',source=src,back='m-home')
    mobile('share','Native share sheet',title('Share'),note('System share sheet — platform-owned UI'),actions(('Copy link','m-viewer'),('Close','m-media')),shell='overlay',status='system',section='System handoffs',source='mobile/screens/media/media-viewer.tsx')
    mobile('rules-pdf','Rulebook handoff',title('Rulebook PDF'),note('The operating system opens the event rulebook link.'),button('Return to event','m-event-detail'),shell='overlay',status='system',section='System handoffs',source='mobile/screens/events/event-details.tsx')
    mobile('organiser','Contact organiser handoff',title('Contact organiser'),note('The operating system opens email or phone.'),button('Return to event','m-event-detail'),shell='overlay',status='system',section='System handoffs',source='mobile/screens/events/event-details.tsx')

    # Planned mobile surfaces: structural controls only, clearly separated from current UI.
    def mp(id,name,*children,**props): mobile(id,name,*children,status='planned',source='docs/MVP_Timeline_Plan_Updated.md',**props)
    mp('landing','Landing',title('Welcome to BGSC'),image('App introduction artwork',180),text('Discover campus events, challenges and achievements.'),button('Explore the app','m-onboarding'),button('Sign in','m-login','outline'),shell='auth')
    mp('onboarding','Onboarding',title('Your campus, connected'),image('Walkthrough panel',160),chips('1 · Events','2 · Points','3 · Community'),button('Next','m-onboarding-2'),button('Skip','m-register','ghost'),shell='auth')
    mp('onboarding-2','Onboarding • points',title('Play. Participate. Progress.'),text('Earn points and follow your achievements.'),button('Get started','m-register'),shell='auth')
    mp('splash','Production splash',text('BGSC','hero'),note('Brand mark and launch state'),button('Preview next screen','m-landing'),shell='auth')
    mp('home-content','Homepage content',title('Dashboard'),card('Live announcement',text('Priority broadcast slot'),button('Read more','m-announcement-detail','outline')),
       card('Featured event',image('Featured cover',100),button('Register','m-event-detail')),row(button('Leaderboard','m-leaderboard','outline'),button('Challenges','m-challenges','outline')),
       card('Recent activity',note('Activity rows')),button('WhatsApp community','m-whatsapp','outline'))
    mp('announcements-full','Announcements • filters',field('SEARCH','Search announcements'),chips('All','Events','General','Important'),card('Announcement title',badge('High priority','warning'),text('Announcement summary'),button('Read announcement','m-announcement-detail','outline')))
    mp('announcement-detail','Announcement detail',title('Announcement title'),chips('High priority','Events'),note('Author · Publish date'),text('Full announcement content'),button('Back to announcements','m-announcements-full','outline'),shell='detail',back='m-announcements-full')
    mp('player-card','Player / user card',node('avatar','BG'),title('Member name'),badge('Member'),row(stat('Points','—'),stat('Rank','—')),card('Player information',field('SPORT','Sport'),field('BIO','Short player bio','textarea')),button('Edit profile','m-edit-profile'),shell='detail',back='m-profile')
    mp('profile-suggestions','Profile • event suggestions',title('Suggested for you'),card('Recommended event',note('Event category and date'),button('View event','m-event-detail','outline')),button('Player card','m-player-card','outline'),shell='detail',back='m-profile')
    mp('settings','Account settings',title('Account settings'),button('Edit profile','m-edit-profile','outline'),button('Notification preferences','m-notification-settings','outline'),button('Connected accounts','m-connected','outline'),button('Help & FAQ','m-faq','outline'),button('Delete account','m-delete-account','danger'),shell='detail',back='m-profile')
    mp('notification-settings','Notification preferences',title('Preferences'),check('Event reminders'),check('Announcements'),check('Challenge updates'),check('Push notifications'),button('Enable push','m-push-permission','outline'),button('Save preferences','m-settings'),shell='detail',back='m-settings')
    mp('push-permission','Push permission',title('Stay up to date'),text('Choose whether BGSC can send reminders.'),actions(('Allow notifications','m-notification-settings'),('Not now','m-settings')),shell='overlay')
    mp('delete-account','Delete account confirmation',title('Delete account?'),note('Account deletion and restoration information belongs here.'),field('CONFIRMATION','Type your username'),button('Confirm deletion','m-login','danger'),button('Keep account','m-settings','outline'),shell='overlay')
    mp('points-history','Points history',title('Your points'),card('Balance',text('—','hero')),chips('All','Events','Challenges','Adjustments'),card('Transaction row',text('Source · Date'),text('+ points','mono')),button('Points breakdown','m-points-breakdown','outline'),button('Ways to earn','m-earn-points','outline'),shell='detail',back='m-profile')
    mp('points-breakdown','Points breakdown',title('Points by source'),row(stat('Events','—'),stat('Challenges','—')),card('Breakdown',node('progress',value=.6),text('Events · Challenges · Volunteering')),button('View history','m-points-history','outline'),shell='detail',back='m-points-history')
    mp('earn-points','Points opportunities',title('Ways to earn'),card('Participate in events',button('Explore events','m-events','outline')),card('Complete challenges',button('Explore challenges','m-challenges','outline')),shell='detail',back='m-points-history')
    mp('challenges','Challenges',title('Challenges'),actions(('Active','m-challenges'),('Completed','m-challenges-completed')),chips('All','Individual','Team'),card('Challenge title',badge('Active'),note('Goal · Reward · Deadline'),button('View challenge','m-challenge-detail')))
    mp('challenge-detail','Challenge detail',title('Challenge title'),card('Goal and rules',text('Challenge description'),text('Reward · End date')),button('Join challenge','m-challenge-progress'),button('Connect Strava','m-strava','outline'),shell='detail',back='m-challenges')
    mp('challenge-progress','Challenge progress',title('Your progress'),card('Progress',text('— / goal','hero'),node('progress',value=.45)),button('Sync activity','m-challenge-progress'),button('View leaderboard','m-leaderboard-challenges','outline'),shell='detail',back='m-challenge-detail')
    mp('challenges-completed','Completed challenges',title('Challenges'),actions(('Active','m-challenges'),('Completed','m-challenges-completed')),card('Completed challenge',badge('Completed','success'),text('Reward earned'),button('View details','m-challenge-detail','outline')))
    mp('strava','Connect Strava',title('Connect Strava'),text('Share activity with BGSC to track challenge progress.'),button('Connect account','m-connected'),button('Not now','m-settings','outline'),shell='detail',back='m-settings')
    mp('connected','Connected accounts',title('Connected accounts'),card('Strava',badge('Connected','success'),note('Last sync · Activity permissions'),button('Sync now','m-connected','outline'),button('Disconnect','m-strava','danger')),shell='detail',back='m-settings')
    mp('media-filters','Media filters',title('Filter media'),field('EVENT','Choose an event','select'),field('FROM DATE','','date'),field('TO DATE','','date'),field('TYPE','All / Image / Video','select'),button('Apply filters','m-media'),button('Reset','m-media','outline'),shell='overlay')
    mp('team-management','My event team',title('Your event team'),badge('Captain approved','success'),field('TEAM NAME','Enter a team name'),button('Create team','m-team-roster'),field('TEAM CODE','Enter invitation code'),button('Join team','m-team-roster','outline'),shell='detail',back='m-registered')
    mp('team-roster','Team roster',title('Team name'),card('Members',text('Captain · Members · Availability')),field('INVITE CODE','Invite code'),button('Share team code','m-team-roster'),shell='detail',back='m-team-management')
    mp('feedback-full','Feedback • submission',title('Send feedback'),field('CATEGORY','Bug / Suggestion / General','select'),field('MESSAGE','Describe your feedback','textarea'),button('Submit feedback','m-feedback-success'),button('Contact us instead','m-contact','outline'))
    mp('feedback-success','Feedback confirmation',title('Thank you'),text('Your feedback has been received.'),button('Back to home','m-home'),shell='overlay')
    mp('contact','Contact us',title('Contact BGSC'),field('NAME','Your name'),field('EMAIL','Your email'),field('SUBJECT','Subject'),field('MESSAGE','Your message','textarea'),button('Send message','m-feedback-success'),button('FAQ','m-faq','outline'),shell='detail',back='m-profile')
    mp('faq','Help & FAQ',title('How can we help?'),field('SEARCH','Search questions'),card('How do I register?',text('Answer content slot')),card('How are points awarded?',text('Answer content slot')),button('Contact us','m-contact'),shell='detail',back='m-settings')
    mp('brackets','Tournament bracket',title('Football Championship'),chips('Quarter-final','Semi-final','Final'),row(card('Quarter-final',text('Team A vs Team B'),button('Match details','m-match','outline')),card('Semi-final',text('Winner 1 vs Winner 2'))),button('Next round','m-brackets-final'),shell='detail',back='m-event-detail')
    mp('brackets-final','Tournament • final',title('Final'),card('Final match',text('Team A vs Team C'),badge('Upcoming'),button('View match','m-match')),button('Previous round','m-brackets','outline'),shell='detail',back='m-brackets')
    mp('match','Match details',title('Match'),card('Team A vs Team B',text('Score · Time · Venue'),badge('Scheduled')),button('Back to bracket','m-brackets','outline'),shell='detail',back='m-brackets')
    mp('verify-email','Verify your email',title('Check your inbox'),text('Open the verification link sent to your email.'),button('Resend verification','m-verify-email'),button('Continue','m-home','outline'),shell='auth')
    mp('reset-password','Set a new password',title('New password'),field('NEW PASSWORD','At least 8 characters','password'),field('CONFIRM PASSWORD','Repeat password','password'),button('Save password','m-login'),shell='auth')
    mp('whatsapp','WhatsApp handoff',title('BGSC community'),note('External WhatsApp group or contact link.'),button('Return to home','m-home'),shell='overlay')

    # Current admin views and source placeholders.
    admin('login','Admin login',title('BGSC Admin Console'),note('Coordinators & Founders Access'),field('USERNAME','Enter username'),field('PASSWORD','Enter password','password'),field('ROLE MODE','Coordinator / Founder / Core','select'),button('Sign In','a-dashboard'),shell='auth',source='web/src/pages/Login.tsx')
    admin('dashboard','Dashboard',card('Welcome to Admin Operations',text('Coordinate tournaments, publish tagged announcements, manage registrations, and award activity points.')),
          row(stat('Total Members','1,248'),stat('Active Events','4'),stat('Tournaments','3'),stat('Points Issued','84,200')),
          source='web/src/pages/Dashboard.tsx',status='demo')
    users=table(['Member','Role','Status','Points','Joined','Actions'],[['Jeet · jeet@example.com','Member','Active','1,250','Sep 2026','View'],['Meera · meera@example.com','Core','Active','2,120','Sep 2026','View']])
    admin('users','Users Directory',title('Users Directory'),note('Manage club athletes, coordinators, and member access permissions.'),row(text('Total Members: 248'),button('Export CSV','a-export','outline')),
          row(field('SEARCH','Search name, email, or handle…'),field('ROLE','All Roles','select'),field('STATUS','All Statuses','select'),button('Reset',variant='outline')),users,
          button('View member details','a-user-detail','outline'),source='web/src/pages/Users.tsx')
    admin('user-detail','Member profile details',title('MEMBER PROFILE DETAILS'),text('Jeet Patel','heading'),note('@jeet · Role: Member · Status: Active'),card('Contact information',text('Email: jeet@example.com'),text('Phone: +91 …'),text('User ID: member-id')),
          card('Club & activity stats',text('Total Activity Points: 1,250 pts'),text('Member Since: Sep 2026')),button('Close','a-users','outline'),source='web/src/components/users/UserDetailModal.tsx',shell='overlay',back='a-users')
    admin('events','Events & Tournaments',row(col(title('Events & Tournaments'),note('Organize and track club leagues, esports brackets, and fitness activities.')),button('Create Tournament','a-create-event')),
          row(field('SEARCH','Search tournament name or venue…'),field('CATEGORY','All Categories','select'),field('STATUS','All Statuses','select'),button('Reset',variant='outline')),
          table(['Event & Category','Format','Dates','Capacity','Status'],[['Football Championship · leagues','Team','Oct 20 – Oct 27','48 / 64','upcoming'],['Campus Run · fitsoc','Solo','Oct 25','32 / 100','upcoming']]),
          button('View Details',variant='outline'),source='web/src/pages/Events.tsx',notes='Source View Details only logs; no current detail destination.')
    admin('create-event','Create New Tournament',title('Create New Tournament'),field('EVENT TITLE','e.g. BGSC Badminton Smash Open'),row(field('CATEGORY','Leagues','select'),field('DOMAIN','Sports','select')),
          row(field('START DATE','','date'),field('END DATE','','date')),field('VENUE / LOCATION','Indoor arena'),row(field('MAX CAPACITY','32','number'),field('INITIAL STATUS','Upcoming / Draft','select')),check('Team Tournament'),
          actions(('Cancel','a-events')),button('Create Tournament','a-events'),source='web/src/components/events/CreateEventModal.tsx',shell='overlay',back='a-events')
    for id,name,copy in [('announcements','Announcements','Announcements Module'),('tournaments','Tournaments','Tournament Brackets Module'),('auction','Auctions','Auctions page'),('media','Media Library','Media Library page'),('leaderboard','Leaderboards','Leaderboards page'),('feedback','Feedback & Support','Feedback and Support page')]:
        admin(id,name,card('',text(copy)),status='placeholder',source='web/src/app/router.tsx')
    admin('export','CSV download handoff',title('Users export'),note('Browser downloads the currently filtered user rows as CSV.'),button('Back to users','a-users','outline'),status='system',shell='overlay',source='web/src/pages/Users.tsx')
    # Planned admin surfaces. Content is intentionally structural and contains no backend wiring.
    def ap(id,name,*children,**props): admin(id,name,*children,status='planned',source='docs/MVP_Timeline_Plan_Updated.md',**props)
    ap('user-edit','Edit member',title('Edit member'),row(field('FULL NAME','Member name'),field('EMAIL','Email')),row(field('PHONE','Phone'),field('STATUS','Active / Suspended','select')),field('BIO','Profile information','textarea'),actions(('Cancel','a-users')),button('Save member','a-users'),shell='overlay',back='a-users')
    ap('user-delete','Delete member confirmation',title('Delete member?'),text('Confirm the selected member and intended action.'),field('REASON','Reason for deletion','textarea'),button('Delete member','a-users','danger'),button('Cancel','a-users','outline'),shell='overlay',back='a-users')
    ap('users-manage','Users • management',title('User management'),row(field('SEARCH','Search members'),field('ROLE','All roles','select'),field('STATUS','All statuses','select')),
       table(['Select','Member','Role','Status','Actions'],[['□','Member name','Member','Active','Edit / Delete']]),actions(('Edit member','a-user-edit'),('Delete','a-user-delete'),('Bulk actions','a-user-bulk'),('Change role','a-user-role'),('Activity logs','a-user-logs')),button('Export users','a-export','outline'))
    ap('user-bulk','Bulk user actions',title('Bulk actions'),text('Selected members'),field('ACTION','Approve / Suspend / Delete','select'),field('REASON','Reason','textarea'),button('Review action','a-users-manage'),button('Cancel','a-users-manage','outline'),shell='overlay')
    ap('user-role','Change member role',title('Role management'),field('MEMBER','Selected member'),field('NEW ROLE','Member / Core / Coordinator / Founder','select'),field('REASON','Reason','textarea'),button('Save role','a-users-manage'),shell='overlay')
    ap('user-logs','User activity logs',title('Activity logs'),row(field('MEMBER','All members','select'),field('FROM DATE','','date'),field('TO DATE','','date')),table(['Time','Member','Action','Details'],[['Timestamp','Member','Action type','Details']]),button('Back to users','a-users-manage','outline'))
    ap('event-detail','Event management • detail',title('Event title'),chips('Category','Status'),row(stat('Registered','—'),stat('Capacity','—'),stat('Waitlisted','—')),
       card('Event information',text('Description · Dates · Venue · Contacts')),actions(('Edit event','a-event-edit'),('Registration form','a-form-builder'),('Participants','a-participants'),('Preview','a-event-preview')),
       actions(('Auction setup','a-auction-setup'),('Bracket setup','a-bracket-setup'),('Duplicate','a-event-duplicate'),('Event media','a-event-media')))
    ap('event-edit','Edit / publish event',title('Edit event'),field('TITLE','Event title'),field('DESCRIPTION','Event description','textarea'),row(field('CATEGORY','Category','select'),field('STATUS','Draft / Published / Closed','select')),
       row(field('START DATE','','date'),field('END DATE','','date')),field('VENUE','Venue'),row(field('CAPACITY','Capacity','number'),field('REGISTRATION DEADLINE','','date')),actions(('Manage categories','a-event-categories'),('Upload image','a-event-media')),button('Save changes','a-event-detail'),button('Publish','a-event-preview','outline'))
    ap('event-categories','Event categories',title('Categories'),field('NAME','Category name'),field('DESCRIPTION','Category description'),button('Add category','a-event-categories'),table(['Category','Description','Actions'],[['Category','Description','Edit / Remove']]),button('Back to event','a-event-edit','outline'))
    ap('event-media','Event image upload',title('Event media'),image('Drop event cover / select files',180),button('Choose image','a-event-media','outline'),field('ALT TEXT','Describe the image'),button('Save event image','a-event-detail'))
    ap('event-duplicate','Duplicate event',title('Duplicate event'),field('NEW TITLE','Copy of event'),row(field('NEW START DATE','','date'),field('NEW END DATE','','date')),check('Copy registration form'),button('Create draft copy','a-event-edit'),shell='overlay')
    ap('event-preview','Event preview',title('Preview event'),image('Event cover',140),card('Public event content',text('Title · Description · Dates · Venue · Rules')),actions(('Back to edit','a-event-edit'),('Publish','a-event-detail')))
    ap('form-builder','Registration form builder',title('Form builder'),row(card('Field palette',chips('Text','Number','Email','Select'),chips('Checkbox','Date','File','User reference'),button('Add field','a-form-field','outline')),
       card('Form canvas',field('FORM TITLE','Registration form'),field('DESCRIPTION','Instructions','textarea'),card('Field 1',text('Label · Type · Required'),button('Edit field','a-form-field','outline')))),actions(('Preview form','a-form-preview'),('Publish form','a-event-detail')))
    ap('form-field','Form field configuration',title('Edit field'),field('FIELD KEY','field_key'),field('LABEL','Field label'),field('TYPE','Field type','select'),check('Required'),row(field('MIN','Minimum'),field('MAX','Maximum')),field('OPTIONS','Options or allowed values','textarea'),field('VISIBLE IF','Conditional field rule'),button('Save field','a-form-builder'),shell='overlay')
    ap('form-preview','Registration form preview',title('Form preview'),field('FULL NAME','Preview value'),field('CHOICE','Choose an option','select'),check('Acknowledgement'),button('Return to builder','a-form-builder','outline'))
    ap('participants','Event participants',title('Participants'),row(field('SEARCH','Search participants'),field('STATUS','All statuses','select')),table(['Member / Team','Status','Role','Attendance'],[['Participant','Confirmed','Member','Not marked']]),
       actions(('Registration responses','a-responses'),('Export CSV','a-registrations-export'),('Message participants','a-communication'),('Back to event','a-event-detail')))
    ap('responses','Registration responses',title('Responses'),row(field('STATUS','All statuses','select'),field('SEARCH','Search responses')),table(['Submitted','Member','Status','Actions'],[['Timestamp','Member','Submitted','Open']]),actions(('View response','a-response-detail'),('Export CSV','a-registrations-export')))
    ap('response-detail','Registration response detail',title('Response'),card('Answers',text('Question · Submitted answer'),text('File attachment slot')),field('REVIEW NOTE','Review note','textarea'),actions(('Approve','a-responses'),('Reject','a-responses'),('Back','a-responses')))
    ap('registrations-export','Registration export',title('Export registrations'),field('FORMAT','CSV','select'),check('Include field answers'),check('Include status and team'),button('Export CSV','a-participants'),shell='overlay')
    ap('communication','Participant communication',title('Message participants'),field('RECIPIENTS','Selected / All / Confirmed','select'),field('SUBJECT','Subject'),field('MESSAGE','Message','textarea'),actions(('Preview','a-communication'),('Send message','a-participants')))
    ap('auction-setup','Auction setup',title('Auction configuration'),field('EVENT','Choose event','select'),row(field('TEAM PURSE','Credits','number'),field('BID INCREMENT','Increment','number'),field('TIMER','Seconds','number')),card('Captains and player pool',text('Approved captains · Registered players')),button('Save setup','a-auction-control'))
    ap('auction-control','Live auction admin',title('Auction control'),row(card('Current player',text('Player · Base price'),text('Current bid · Leading team')),card('Live bids',text('Bid log rows'))),actions(('Start','a-auction-control'),('Pause','a-auction-control'),('Close bidding','a-auction-winner')),actions(('Next player','a-auction-control'),('Mark sold','a-auction-winner'),('Mark unsold','a-auction-control')),button('View winners','a-auction-winner','outline'))
    ap('auction-winner','Auction winners',title('Winner confirmation'),table(['Player','Team','Amount','Status'],[['Player name','Team name','Credits','Pending confirmation']]),actions(('Confirm winner','a-auction-control'),('Back to auction','a-auction-control')))
    ap('points-adjust','Adjust member points',title('Points adjustment'),field('MEMBER','Search member'),row(field('AMOUNT','Points','number'),field('ACTION','Credit / Debit','select')),field('REASON','Reason','textarea'),button('Review adjustment','a-points-adjust'),button('Points rules','a-points-rules','outline'))
    ap('points-rules','Points rules',title('Points rules'),table(['Source','Rule','Points','Actions'],[['Event','Participation','Points','Edit']]),field('RULE NAME','Rule name'),row(field('SOURCE','Source','select'),field('POINTS','Points','number')),button('Save rule','a-points-rules'))
    ap('leaderboards-manage','Leaderboard administration',title('Leaderboards'),row(field('BOARD','Global / Event / Challenge','select'),field('PERIOD','Period','select'),field('CATEGORY','Category','select')),table(['Rank','Member / Team','Score'],[['Rank','Name','Points']]),actions(('Export CSV','a-leaderboards-manage'),('Adjust points','a-points-adjust')))
    ap('challenges','Challenge management',title('Challenges'),row(field('SEARCH','Search challenges'),button('Create challenge','a-challenge-edit')),table(['Challenge','Type','Status','Actions'],[['Challenge title','Individual / Team','Active','Edit']]),button('Edit challenge','a-challenge-edit','outline'))
    ap('challenge-edit','Create / edit challenge',title('Challenge editor'),field('TITLE','Challenge title'),field('DESCRIPTION','Description','textarea'),row(field('TYPE','Individual / Team','select'),field('GOAL','Target')),row(field('REWARD','Points','number'),field('DEADLINE','','date')),actions(('Save challenge','a-challenges'),('Delete challenge','a-challenges')))
    ap('media-manage','Media library management',title('Media library'),row(field('TYPE','All types','select'),field('CATEGORY','All categories','select'),field('STATUS','All statuses','select')),row(image('Media slot',120),image('Media slot',120),image('Media slot',120)),actions(('Bulk upload','a-media-upload'),('Moderation queue','a-media-review')))
    ap('media-upload','Bulk media upload',title('Upload media'),image('Drop multiple files / select files',160),button('Select files','a-media-upload','outline'),row(field('CATEGORY','Category','select'),field('EVENT','Event','select')),field('TAGS','Tags'),button('Upload selected','a-media-manage'))
    ap('media-review','Media approval queue',title('Moderation queue'),image('Selected media',180),field('CATEGORY','Category','select'),field('TAGS','Tags'),field('REVIEW NOTE','Review note','textarea'),actions(('Approve','a-media-manage'),('Reject','a-media-manage')))
    ap('broadcast-compose','Compose broadcast',title('Broadcast message'),field('TITLE','Title'),field('AUDIENCE','All members / Event / Group','select'),field('CHANNEL','In-app / WhatsApp','select'),field('MESSAGE','Message content','textarea'),actions(('Schedule','a-broadcast-schedule'),('Send now','a-broadcast-history')))
    ap('broadcast-schedule','Schedule broadcast',title('Schedule message'),row(field('SEND DATE','','date'),field('SEND TIME','','time')),field('TIMEZONE','Asia/Kolkata'),button('Confirm schedule','a-broadcast-history'),shell='overlay')
    ap('broadcast-history','Broadcast history',title('Broadcasts'),button('New broadcast','a-broadcast-compose'),table(['Title','Audience','Scheduled','Delivered','Status'],[['Message','Audience','Date / time','Count','Sent / Scheduled']]),card('Delivery analytics',row(stat('Delivered','—'),stat('Failed','—'))))
    ap('announcements-manage','Announcement management',title('Announcements'),button('Create announcement','a-announcement-edit'),table(['Title','Category','Priority','Status'],[['Title','Category','Priority','Published']]),button('Edit announcement','a-announcement-edit','outline'))
    ap('announcement-edit','Announcement editor',title('Edit announcement'),field('TITLE','Title'),field('CONTENT','Announcement content','textarea'),row(field('CATEGORY','Category','select'),field('PRIORITY','Priority','select')),field('PUBLISH AT','','date'),button('Publish announcement','a-announcements-manage'))
    ap('hof-manage','Hall of Fame management',title('Hall of Fame'),button('Add entry','a-hof-edit'),table(['Honoree','Achievement','Year','Featured'],[['Name','Achievement','Year','Yes / No']]),actions(('Edit entry','a-hof-edit'),('Manage achievements','a-achievements')))
    ap('hof-edit','Hall of Fame editor',title('Edit honour'),field('HONOREE','Member / Team'),field('TITLE','Achievement title'),field('STORY','Story','textarea'),row(field('YEAR','Year','number'),field('CATEGORY','Category','select')),check('Feature this member'),actions(('Save entry','a-hof-manage'),('Delete entry','a-hof-manage')))
    ap('achievements','Achievement management',title('Achievements'),field('TITLE','Achievement name'),field('BADGE','Badge identifier'),field('AWARD POINTS','Points','number'),button('Save achievement','a-hof-manage'))
    ap('feedback-inbox','Feedback inbox',title('Feedback & contact'),actions(('Feedback','a-feedback-inbox'),('Contact submissions','a-contact-inbox')),row(field('CATEGORY','All categories','select'),field('STATUS','Open / Replied','select')),
       table(['From','Category','Subject','Status'],[['Member','Suggestion','Subject','Open']]),button('Read & respond','a-feedback-reply','outline'))
    ap('contact-inbox','Contact submissions',title('Contact submissions'),table(['From','Subject','Received','Status'],[['Sender','Subject','Timestamp','Open']]),button('Read & respond','a-feedback-reply','outline'))
    ap('feedback-reply','Reply to feedback / contact',title('Submission detail'),card('Message',text('Sender · Subject'),text('Full submitted message')),field('RESPONSE','Write a response','textarea'),actions(('Send reply','a-feedback-inbox'),('Mark resolved','a-feedback-inbox')))
    ap('bracket-setup','Tournament bracket setup',title('Bracket setup'),field('EVENT','Select event','select'),row(field('FORMAT','Single elimination / Round robin','select'),field('PARTICIPANTS','Confirmed teams','select')),table(['Seed','Team'],[['1','Team A'],['2','Team B']]),button('Generate bracket','a-bracket-results'))
    ap('bracket-results','Bracket results management',title('Bracket management'),chips('Quarter-final','Semi-final','Final'),row(card('Match 1',text('Team A vs Team B'),row(field('A SCORE','0','number'),field('B SCORE','0','number'))),card('Next round',text('Winner vs Winner'))),actions(('Save result','a-bracket-results'),('Publish bracket','a-event-detail')))
    ap('analytics','Analytics dashboard',title('Analytics'),row(stat('Users','—'),stat('Events','—'),stat('Engagement','—')),row(card('Activity over time',image('Chart slot',160)),card('Participation',image('Chart slot',160))),row(field('FROM DATE','','date'),field('TO DATE','','date')),button('Export report','a-analytics','outline'))
    ap('admin-help','Admin help',title('Admin guide'),card('Manage members',text('Workflow instructions')),card('Create an event',text('Workflow instructions')),card('Run an auction',text('Workflow instructions')),button('Back to dashboard','a-dashboard','outline'))
    mp('plan-index','Planned mobile flows',title('Unfinished MVP flows'),note('Wireframe navigation hub — proposed UI only.'),
       *[button(label,dest,'outline') for label,dest in [('Landing & onboarding','m-landing'),('Production splash','m-splash'),('Home content','m-home-content'),('Announcements','m-announcements-full'),('Player card','m-player-card'),('Profile suggestions','m-profile-suggestions'),('Settings','m-settings'),('Points','m-points-history'),('Challenges','m-challenges'),('Strava','m-strava'),('Media filters','m-media-filters'),('Team management','m-team-management'),('Feedback','m-feedback-full'),('Contact & FAQ','m-contact'),('Tournament brackets','m-brackets'),('Email verification','m-verify-email'),('Password reset','m-reset-password')]])
    ap('plan-index','Planned admin flows',title('Unfinished admin workflows'),note('Wireframe navigation hub — proposed UI only.'),
       *[button(label,dest,'outline') for label,dest in [('User management','a-users-manage'),('Event management','a-event-detail'),('Form builder','a-form-builder'),('Participants & responses','a-participants'),('Auction administration','a-auction-setup'),('Points rules & adjustment','a-points-adjust'),('Leaderboards','a-leaderboards-manage'),('Challenges','a-challenges'),('Media & moderation','a-media-manage'),('Broadcasts','a-broadcast-history'),('Announcements','a-announcements-manage'),('Hall of Fame','a-hof-manage'),('Feedback & contact','a-feedback-inbox'),('Tournament brackets','a-bracket-setup'),('Analytics','a-analytics'),('Admin help','a-admin-help')]])


MOBILE_TABS = [('Home','m-home','home'),('Events','m-events','calendar'),('Leaderboard','m-leaderboard','trophy'),('Profile','m-profile','person')]
ADMIN_NAV = [('Dashboard','a-dashboard'),('Events','a-events'),('Announcements','a-announcements'),('Users Directory','a-users'),('Tournaments','a-tournaments'),('Auctions','a-auction'),('Media Library','a-media'),('Leaderboards','a-leaderboard'),('Feedback & Support','a-feedback')]


def walk(nodes):
    for n in nodes:
        yield n
        yield from walk(n.get('children',[]))


def file_path(s): return ('skeletons/' if s['status']=='planned' else 'screens/')+s['id']+'.html'


def render_node(n, lookup):
    esc=html.escape
    kind=n['kind']; label=esc(str(n.get('text',''))); children=''.join(render_node(x,lookup) for x in n.get('children',[]))
    if kind=='text': return f'<p class="type-{n.get("style","body")}">{label}</p>'
    if kind=='row' or kind=='column': return f'<div class="{kind}" data-layout="{kind}">{children}</div>'
    if kind=='card': return f'<section class="card {n.get("variant", "solid")}" data-layout="column">'+(f'<h2>{label}</h2>' if label else '')+children+'</section>'
    if kind=='button':
        icon=f'<img src="../assets/{n["icon"]}.svg" alt="" width="20" height="20">' if n.get('icon') else ''
        attrs=f'class="button {n.get("variant","primary")}"'
        if n.get('to'): return f'<a {attrs} href="../{file_path(lookup[n["to"]])}" data-target="{n["to"]}">{icon}{label}</a>'
        return f'<button {attrs} type="button" data-local-action="{label}">{icon}{label}</button>'
    if kind=='field':
        placeholder=esc(n.get('placeholder','')); type=n.get('inputType','text')
        if type=='textarea': control=f'<textarea placeholder="{placeholder}" rows="4"></textarea>'
        elif type=='select': control='<select>'+''.join(f'<option>{esc(x.strip())}</option>' for x in n.get('placeholder','Choose').split('/'))+'</select>'
        else: control=f'<input type="{type}" placeholder="{placeholder}">'
        return f'<label class="field"><span>{label}</span>{control}</label>'
    if kind=='check': return f'<label class="check"><input type="checkbox">{label}</label>'
    if kind=='badge': return f'<span class="badge {n.get("variant","muted")}">{label}</span>'
    if kind=='chips': return f'<div class="chips">{children}</div>'
    if kind=='image': return f'<div class="media-slot" role="img" aria-label="{label}" style="min-height:{n.get("height",140)}px">{label}</div>'
    if kind=='avatar': return f'<div class="avatar">{label}</div>'
    if kind=='stat': return f'<div class="stat"><strong>{label}</strong><span>{esc(n["label"])}</span></div>'
    if kind=='progress': return f'<progress max="1" value="{n["value"]}"></progress>'
    if kind=='table': return '<div class="table-wrap"><table><thead><tr>'+''.join(f'<th>{esc(x)}</th>' for x in n['headers'])+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td>{esc(str(x))}</td>' for x in row)+'</tr>' for row in n['rows'])+'</tbody></table></div>'
    raise ValueError(kind)


def write_html():
    lookup={s['id']:s for s in SCREENS}
    all_edges=[]
    for s in SCREENS:
        for n in walk(s['children']):
            if n.get('to'):
                assert n['to'] in lookup,(s['id'],n['to'])
                all_edges.append(dict(fromScreen=s['id'],toScreen=n['to'],label=n['text'],kind='proposed' if s['status']=='planned' else 'source UI'))
        shared=[]
        if s['platform']=='mobile' and s['shell'] not in ('auth','profile','overlay'):
            shared += [('Back' if s['back'] else 'Menu',s['back'] or 'm-drawer'),('Notifications','m-notifications')]
        if s['platform']=='mobile' and s['shell'] in ('main','profile'):
            shared += [(label,id) for label,id,icon in MOBILE_TABS]
        if s['platform']=='admin' and s['shell']=='main':
            shared += ADMIN_NAV+[('Sign Out','a-login')]
        for label,dest in shared:
            all_edges.append(dict(fromScreen=s['id'],toScreen=dest,label=label,kind='proposed' if s['status']=='planned' else 'source UI'))
        header=''
        if s['platform']=='mobile' and s['shell'] not in ('auth','profile','overlay'):
            dest=s['back'] or 'm-drawer'; icon='arrow-back' if s['back'] else 'menu'
            header=f'<header class="app-header"><a href="../{file_path(lookup[dest])}" aria-label="'+('Back' if s['back'] else 'Menu')+f'"><img src="../assets/{icon}.svg" width="24" height="24" alt=""></a><strong>{html.escape(s["name"])}</strong><a href="../screens/m-notifications.html" aria-label="Notifications"><img src="../assets/notifications-outline.svg" width="24" height="24" alt=""></a></header>'
        footer=''
        if s['platform']=='mobile' and s['shell'] in ('main','profile'):
            footer='<nav class="bottom-tabs" aria-label="Primary navigation">'+''.join(f'<a href="../screens/{id}.html"><img src="../assets/{icon}.svg" width="22" height="22" alt=""><span>{label}</span></a>' for label,id,icon in MOBILE_TABS)+'</nav>'
        body=''.join(render_node(n,lookup) for n in s['children'])
        if s['shell']=='auth' and s['platform']=='mobile': body='<div class="auth-hero"><img src="../assets/auth-cat.gif" alt="BGSC pixel art cat"></div><div class="auth-card column">'+body+'</div>'
        else: body='<div class="content column">'+body+'</div>'
        if s['platform']=='admin' and s['shell']=='main':
            nav='<aside class="sidebar"><h2>BGSC Admin</h2><nav>'+''.join(f'<a href="../screens/{id}.html">{label}</a>' for label,id in ADMIN_NAV)+'</nav></aside>'
            header='<header class="admin-header"><span>Admin | '+html.escape(s['name']).upper()+'</span><a href="../screens/a-login.html">Sign Out</a></header>'
            body=nav+'<div class="admin-main">'+header+body+'</div>'
        else: body=header+body+footer
        mode='auth' if s['shell']=='auth' and s['platform']=='mobile' else 'admin' if s['platform']=='admin' else 'mobile'
        label='PLANNED WIREFRAME' if s['status']=='planned' else 'SOURCE UI · '+s['status'].upper()
        document=f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BGSC — {html.escape(s['name'])}</title><link rel="stylesheet" href="../styles.css"></head>
<body class="{mode} shell-{s['shell']}"><div class="review-bar"><a href="../index.html">← All screens</a><span>{label}</span><button id="outline-toggle" type="button">Layout outlines</button></div>
<main class="screen {s['platform']}" data-screen="{s['id']}" data-layout="column">{body}</main>
<footer class="review-note">{html.escape(s.get('notes',''))} <code>{html.escape(s['source'])}</code> · Demonstration content. No backend calls.</footer><div role="status" id="toast"></div><script src="../prototype.js"></script></body></html>'''
        dest=ROOT/file_path(s);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(document)
    categories={}
    for s in SCREENS:
        key=s['platform'].title()+' — '+('Planned HTML skeletons' if s['status']=='planned' else s['section'])
        categories.setdefault(key,[]).append(s)
    listing=''.join('<section class="catalog-group"><h2>'+html.escape(key)+'</h2><div class="catalog-grid">'+''.join(f'<a class="catalog-link" data-search="{html.escape((v["name"]+" "+v["status"]+" "+v["platform"]).lower())}" href="{file_path(v)}"><span>{html.escape(v["name"])}</span><small>{v["status"]}</small></a>' for v in vals)+'</div></section>' for key,vals in categories.items())
    (ROOT/'index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BGSC frontend design inventory</title><link rel="stylesheet" href="styles.css"></head><body class="catalog"><header><p class="eyebrow">BGSC APPLICATION / FRONTEND</p><h1>Screens & navigation</h1><p>Current UI follows the existing React Native / React layout. Unfinished MVP work is shown as labelled, backend-free HTML wireframes.</p><a href="https://www.figma.com/design/oLGMtiAnxLElj27lRQciuq">Open the Figma file ↗</a><p>Rows → horizontal Auto Layout / flex rows. Columns → vertical Auto Layout / flex columns. Cards → nested containers.</p><label>Find a screen <input id="catalog-search" placeholder="Search mobile, admin, challenge…"></label><a href="navigation.html">View every navigation connection →</a></header>'''+listing+'<script src="prototype.js"></script></body></html>')
    navrows=''.join(f'<tr><td>{html.escape(lookup[e["fromScreen"]]["name"])}</td><td>{html.escape(e["label"])}</td><td><a href="{file_path(lookup[e["toScreen"]])}">{html.escape(lookup[e["toScreen"]]["name"])}</a></td><td>{e["kind"]}</td></tr>' for e in all_edges)
    (ROOT/'navigation.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BGSC navigation inventory</title><link rel="stylesheet" href="styles.css"></head><body class="catalog"><a href="index.html">← Screen catalogue</a><h1>What opens what</h1><p>Links describe UI destinations. Planned links are proposals. Buttons without a source action remain local demonstration controls.</p><table><thead><tr><th>From</th><th>Control</th><th>To</th><th>Connection</th></tr></thead><tbody>'+navrows+'</tbody></table></body></html>')
    (ROOT/'screen-inventory.json').write_text(json.dumps(dict(screens=SCREENS,edges=all_edges,mobileTabs=MOBILE_TABS,adminNav=ADMIN_NAV),ensure_ascii=False,indent=2))
    print(f'Generated {len(SCREENS)} screens, {sum(s["status"]=="planned" for s in SCREENS)} planned skeletons, {len(all_edges)} explicit UI connections.')


if __name__=='__main__':
    build_inventory()
    write_html()
