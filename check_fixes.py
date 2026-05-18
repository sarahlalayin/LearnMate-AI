with open('app_api.js', 'r', encoding='utf-8') as f:
    js = f.read()
print('DEMO999 in app_api.js:', 'DEMO999' in js)
print('DEMO123 remaining:', 'DEMO123' in js)
print('placeholder removed:', 'API' not in js or 'approve-proposal' in js)
print('approveProposal real fetch:', '/rewards/approve-proposal' in js)
print('rejectProposal real fetch:', '/rewards/reject-proposal' in js)

with open('index_api.html', 'r', encoding='utf-8') as f:
    html = f.read()
print('DEMO999 in index_api.html:', 'DEMO999' in html)
print('screen-student-videos in HTML:', 'screen-student-videos' in html)
print('s-videos-list in HTML:', 's-videos-list' in html)

with open('backend/server.js', 'r', encoding='utf-8') as f:
    srv = f.read()
print('approve-proposal route in server.js:', '/api/rewards/approve-proposal' in srv)
print('reject-proposal route in server.js:', '/api/rewards/reject-proposal' in srv)
print('Total lines in server.js:', srv.count('\n'))
