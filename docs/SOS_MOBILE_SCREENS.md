# Tóm tắt Màn hình SOS cho Mobile App

## Màn hình Đã Có

### 1. SOSAlertScreen (Driver)
**File:** `src/screens/driver/SOSAlertScreen.jsx`  
**Mục đích:** Màn hình trigger SOS cho driver  
**Tính năng:**
- Chọn loại khẩn cấp (Tai nạn, Xe hỏng, An toàn cá nhân, Khác)
- Countdown 5 giây trước khi trigger
- Quick actions (Chia sẻ vị trí, Tin nhắn SOS)
- Emergency contacts list
- Safety tips

### 2. SOSButton Component
**File:** `src/components/SOSButton.jsx`  
**Mục đích:** Component button để trigger SOS (hold 5 seconds)  
**Được sử dụng trong:**
- `RideTrackingScreen.jsx` (rider)
- `DriverRideTrackingScreen.jsx` (driver)

### 3. sosService
**File:** `src/services/sosService.js`  
**Methods hiện có:**
- `triggerAlert()` - Kích hoạt SOS alert

---

## Màn hình Cần Tạo Thêm

### 1. MySOSAlertsScreen (Rider)
**File cần tạo:** `src/screens/main/MySOSAlertsScreen.jsx`  
**Mục đích:** Danh sách SOS alerts của rider (APP-PROF-003)

**Tính năng cần có:**
- **Header:** "Cảnh báo SOS của tôi" / "My SOS Alerts"
- **Description:** "Quản lý và theo dõi các cảnh báo khẩn cấp của bạn"
- **SOS Trigger Button** (nếu cần trigger từ màn hình này):
  - Red circular button với exclamation icon
  - Label: "SOS"
  - Instruction: "Giữ nút trong 5 giây để kích hoạt cảnh báo khẩn cấp"
- **Active Alert Warning** (nếu có active alert):
  - Red banner với warning icon
  - Message: "Bạn có cảnh báo SOS đang hoạt động"
  - "Xem chi tiết →" link
- **Filter dropdown:**
  - Options: "Tất cả", "Đang hoạt động", "Đã báo cáo", "Đã xác nhận", "Đã giải quyết", "Báo động giả"
- **Alerts list:**
  - Alert ID: "Cảnh báo SOS #X"
  - Status badge (color-coded):
    - ACTIVE/ESCALATED: Red
    - ACKNOWLEDGED: Blue
    - RESOLVED: Green
    - FALSE_ALARM: Gray
  - Created date/time
  - Description (nếu có)
  - Location coordinates
  - Escalation count (nếu > 0)
  - "Xem chi tiết" button
- **Empty state:**
  - Icon: ExclamationTriangleIcon
  - Message: "Không có cảnh báo SOS"
  - Description: "Bạn chưa có cảnh báo SOS nào..."
- **Auto-refresh:**
  - Mỗi 10 giây nếu có active alert
  - Mỗi 30 giây nếu không có active alert
- **Pull to refresh**

**API cần gọi:**
- `GET /api/v1/sos/alerts/me?status=ACTIVE,ESCALATED,ACKNOWLEDGED`

---

### 2. SOSAlertDetailScreen (Rider)
**File cần tạo:** `src/screens/main/SOSAlertDetailScreen.jsx`  
**Mục đích:** Chi tiết SOS alert với timeline, map (APP-PROF-004)

**Tính năng cần có:**
- **Header:**
  - Alert ID: "Cảnh báo SOS #X"
  - Status badge
  - Escalation count badge (nếu > 0)
  - Back button
- **User Information:**
  - Triggered by: User name và ID
  - Phone number
  - Driver information (nếu trong ride)
- **Location Information:**
  - Latitude và longitude
  - Link để mở Google Maps
- **Time Information:**
  - Created at
  - Acknowledged at (nếu đã acknowledge)
  - Resolved at (nếu đã resolve)
- **Emergency Contacts:**
  - List of notified contacts
  - Primary contact indicator
  - Phone numbers
- **Description:**
  - Alert description (nếu có)
- **Ride Details** (nếu có ride):
  - Ride ID
  - Pickup location
  - Dropoff location
  - Driver name và vehicle
  - **Map với markers:**
    - Green: Pickup point
    - Red: Dropoff point
    - Orange: SOS location
    - Blue: Driver location (nếu tracking)
    - Yellow: Rider location (nếu tracking)
  - Planned route (gray dashed line)
  - Actual tracking route (blue solid line)
- **Timeline:**
  - List of events theo thứ tự thời gian:
    - CREATED: Alert created
    - ORIGINATOR_NOTIFIED: User notified
    - CONTACT_NOTIFIED: Emergency contacts notified
    - ADMIN_NOTIFIED: Admin notified
    - ESCALATED: Alert escalated
    - ACKNOWLEDGED: Admin acknowledged
    - RESOLVED: Alert resolved
  - Mỗi event hiển thị:
    - Event type icon
    - Event description
    - Timestamp
    - Metadata (nếu có)
- **Auto-refresh:**
  - Timeline auto-refresh mỗi 15 giây nếu alert ACTIVE hoặc ESCALATED
  - Map update real-time nếu ride đang active

**API cần gọi:**
- `GET /api/v1/sos/alerts/{alertId}` - Lấy chi tiết alert
- `GET /api/v1/sos/alerts/{alertId}/timeline` - Lấy timeline events

---

### 3. EmergencyContactsScreen (Optional - nếu chưa có)
**File cần tạo:** `src/screens/main/EmergencyContactsScreen.jsx`  
**Mục đích:** Quản lý emergency contacts

**Tính năng cần có:**
- List emergency contacts
- Add new contact
- Edit contact
- Delete contact
- Set primary contact

**API cần gọi:**
- `GET /api/v1/sos/contacts` - Lấy danh sách contacts
- `POST /api/v1/sos/contacts` - Tạo contact
- `PUT /api/v1/sos/contacts/{contactId}` - Update contact
- `DELETE /api/v1/sos/contacts/{contactId}` - Xóa contact
- `POST /api/v1/sos/contacts/{contactId}/primary` - Set primary

---

## Cập nhật sosService

**File:** `src/services/sosService.js`  
**Cần thêm các methods:**

```javascript
const sosService = {
  // Đã có
  async triggerAlert({ ... }) { ... },

  // Cần thêm
  async getMyAlerts(statuses = null) {
    const params = statuses ? { status: statuses.join(',') } : {};
    return await apiService.get(ENDPOINTS.SOS.MY_ALERTS, params);
  },

  async getAlert(alertId) {
    return await apiService.get(`${ENDPOINTS.SOS.TRIGGER}/${alertId}`);
  },

  async getAlertTimeline(alertId) {
    return await apiService.get(`${ENDPOINTS.SOS.TRIGGER}/${alertId}/timeline`);
  },

  // Optional - Emergency Contacts
  async getContacts() {
    return await apiService.get(ENDPOINTS.SOS.CONTACTS);
  },

  async createContact(contactData) {
    return await apiService.post(ENDPOINTS.SOS.CONTACTS, contactData);
  },

  async updateContact(contactId, contactData) {
    return await apiService.put(`${ENDPOINTS.SOS.CONTACTS}/${contactId}`, contactData);
  },

  async deleteContact(contactId) {
    return await apiService.delete(`${ENDPOINTS.SOS.CONTACTS}/${contactId}`);
  },

  async setPrimaryContact(contactId) {
    return await apiService.post(`${ENDPOINTS.SOS.CONTACTS}/${contactId}/primary`);
  },
};
```

---

## Cập nhật API Endpoints

**File:** `src/config/api.js`  
**Cần thêm:**

```javascript
SOS: {
  TRIGGER: "/sos/alerts",
  MY_ALERTS: "/sos/alerts/me",
  CONTACTS: "/sos/contacts", // Cần thêm
  // Các endpoints khác sẽ được build từ TRIGGER và CONTACTS
}
```

---

## Cập nhật Navigation

**File:** `App.jsx`  
**Cần thêm screens:**

```javascript
// Import
import MySOSAlertsScreen from './src/screens/main/MySOSAlertsScreen.jsx';
import SOSAlertDetailScreen from './src/screens/main/SOSAlertDetailScreen.jsx';
import EmergencyContactsScreen from './src/screens/main/EmergencyContactsScreen.jsx'; // Optional

// Trong Stack.Navigator
<Stack.Screen name="MySOSAlerts" component={MySOSAlertsScreen} />
<Stack.Screen name="SOSAlertDetail" component={SOSAlertDetailScreen} />
<Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} /> // Optional
```

---

## Navigation Flow

### Rider Flow:
1. **RideTrackingScreen** → SOSButton → Trigger SOS → Navigate to **MySOSAlertsScreen**
2. **MySOSAlertsScreen** → Tap alert → Navigate to **SOSAlertDetailScreen**
3. **ProfileScreen** → "Emergency Contacts" → Navigate to **EmergencyContactsScreen** (optional)

### Driver Flow:
1. **DriverRideTrackingScreen** → SOSButton → Trigger SOS
2. **DriverMainStack** → "SOS Alert" menu → Navigate to **SOSAlertScreen** (đã có)

---

## Tóm tắt Công việc

### Bắt buộc (High Priority):
1. ✅ **MySOSAlertsScreen** - Danh sách alerts của rider
2. ✅ **SOSAlertDetailScreen** - Chi tiết alert với timeline và map
3. ✅ **Update sosService** - Thêm methods `getMyAlerts()`, `getAlert()`, `getAlertTimeline()`
4. ✅ **Update App.jsx** - Thêm navigation cho 2 screens mới

### Tùy chọn (Medium Priority):
5. ⚠️ **EmergencyContactsScreen** - Quản lý emergency contacts (nếu chưa có trong ProfileScreen)
6. ⚠️ **Update sosService** - Thêm methods cho emergency contacts management

### UI Components cần tạo:
- **StatusBadge** - Component hiển thị status với màu sắc
- **TimelineItem** - Component hiển thị một event trong timeline
- **AlertCard** - Component hiển thị alert trong list
- **MapView với markers** - Component map cho SOS location và ride route

---

## Test Cases liên quan

- **APP-PROF-003:** Verify that a rider can view their list of SOS alerts
- **APP-PROF-004:** Verify that a rider can view detailed information about their SOS alert
- **APP-PROF-005:** Verify that a rider can trigger SOS alert even when not in an active ride

---

## Notes

- **SOS History** mà user đề cập có thể là tên khác của **MySOSAlertsScreen** hoặc là một tab/filter trong màn hình đó
- Có thể tích hợp SOS trigger button vào **MySOSAlertsScreen** để user có thể trigger SOS từ màn hình này (APP-PROF-005)
- Timeline cần auto-refresh để hiển thị real-time updates khi alert đang active
- Map cần hiển thị đúng markers và routes nếu alert liên quan đến ride

