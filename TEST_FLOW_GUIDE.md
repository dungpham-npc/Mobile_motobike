# Hướng Dẫn Test Flow Hoàn Chỉnh - Motorbike Sharing System

## 📋 Mục Lục
1. [Chuẩn Bị](#chuẩn-bị)
2. [Flow Test Driver](#flow-test-driver)
3. [Flow Test Rider](#flow-test-rider)
4. [Flow Test Tích Hợp](#flow-test-tích-hợp)
5. [Kiểm Tra Lỗi Thường Gặp](#kiểm-tra-lỗi-thường-gặp)

---

## 🔧 Chuẩn Bị

### Yêu Cầu Hệ Thống
- ✅ Backend đang chạy tại `http://10.3.83.191:8080`
- ✅ WebSocket server hoạt động
- ✅ Database có dữ liệu test (users, vehicles, locations)
- ✅ 2 thiết bị hoặc 2 tài khoản để test driver và rider

### Tài Khoản Test
**Driver:**
- Email: `driver@test.com`
- Password: `password123`
- Có vehicle đã đăng ký

**Rider:**
- Email: `rider@test.com`
- Password: `password123`

### Cấu Hình App
- ✅ Location permission đã được cấp
- ✅ Background location permission đã được cấp (Android)
- ✅ FCM token đã được đăng ký
- ✅ WebSocket connection đang hoạt động

---

## 🚗 Flow Test Driver

### Bước 1: Đăng Nhập và Tạo Chuyến Đi
1. **Đăng nhập với tài khoản Driver**
   - Mở app
   - Chọn "Driver" mode
   - Đăng nhập với `driver@test.com` / `password123`
   - ✅ Kiểm tra: Đăng nhập thành công, chuyển đến `DriverHomeScreen`

2. **Tạo Shared Ride**
   - Nhấn nút "Tạo chuyến đi" hoặc tương tự
   - Chọn điểm bắt đầu (Start Location)
     - Có thể chọn từ POI hoặc nhập địa chỉ
   - Chọn điểm kết thúc (End Location)
   - Chọn thời gian khởi hành (Scheduled Departure Time)
     - Có thể chọn "Ngay bây giờ" hoặc thời gian trong tương lai
   - Chọn số chỗ trống
   - Nhấn "Tạo chuyến đi"
   - ✅ Kiểm tra: 
     - Ride được tạo thành công
     - Status = `SCHEDULED` hoặc `ONGOING` (nếu chọn "Ngay bây giờ")
     - Quay về `DriverHomeScreen`
     - Có thông báo xác nhận

### Bước 2: Nhận Ride Request từ Rider
1. **Chờ Ride Request**
   - Ở `DriverHomeScreen`, chờ rider tạo booking
   - ✅ Kiểm tra:
     - Có WebSocket notification về ride offer
     - Modal `RideOfferModal` hiển thị
     - Hiển thị thông tin: rider name, pickup/dropoff locations, fare

2. **Accept Ride Request**
   - Xem thông tin ride offer
   - Nhấn "Chấp nhận"
   - ✅ Kiểm tra:
     - Modal đóng lại
     - Navigate đến `DriverRideTrackingScreen`
     - Ride status = `CONFIRMED`
     - Polyline từ driver đến pickup hiển thị trên map
     - Phase = `toPickup`

### Bước 3: Simulate Di Chuyển Đến Điểm Đón
1. **Bắt Đầu Simulation**
   - Ở `DriverRideTrackingScreen`
   - Nhấn nút "Giả lập tới điểm đón"
   - ✅ Kiểm tra:
     - Simulation bắt đầu
     - Driver marker di chuyển theo polyline
     - Polyline tự động cắt từ vị trí hiện tại (phần đã đi qua biến mất)
     - Map tự động recenter theo driver location
     - Location updates được gửi lên server qua WebSocket (`/app/ride.track.{rideId}`)
     - Console log: `📍 Simulation progress: X%`

2. **Theo Dõi Simulation**
   - Quan sát driver marker di chuyển
   - ✅ Kiểm tra:
     - Marker di chuyển mượt mà, không giật
     - Polyline chỉ hiển thị phần còn lại
     - Không có log spam "Updating polyline" liên tục
     - Location tracking đang gửi data lên server

3. **Đến Điểm Đón**
   - Chờ simulation đến điểm đón (khoảng 30m)
   - ✅ Kiểm tra:
     - Alert hiển thị: "Đã tới điểm đón"
     - Simulation tự động dừng
     - Driver location gần với pickup location

### Bước 4: Nhận Khách và Bắt Đầu Chuyến Đi
1. **Nhận Khách**
   - Nhấn "Nhận khách" trong alert
   - ✅ Kiểm tra:
     - Có delay 2 giây để sync location với backend
     - API call: `POST /api/v1/rides/{rideId}/start` (nếu status = SCHEDULED)
     - API call: `POST /api/v1/rides/start-ride-request` với `rideId` và `rideRequestId`
     - Không có lỗi "Driver is too far from pickup location"
     - Ride status chuyển thành `ONGOING`
     - Request status chuyển từ `CONFIRMED` → `ONGOING`
     - Phase chuyển thành `toDropoff`
     - Polyline chuyển sang polyline từ pickup đến dropoff

2. **Nếu Bị Lỗi "Too Far"**
   - ✅ Kiểm tra:
     - Alert hiển thị: "Quá xa điểm đón"
     - Thông báo hướng dẫn đợi GPS cập nhật
     - Có thể thử lại sau vài giây

### Bước 5: Simulate Di Chuyển Đến Điểm Đến
1. **Bắt Đầu Simulation Đến Dropoff**
   - Nhấn nút "Giả lập tới điểm đến"
   - ✅ Kiểm tra:
     - Simulation bắt đầu từ pickup location
     - Driver marker di chuyển theo polyline từ pickup đến dropoff
     - Polyline tự động cắt từ vị trí hiện tại
     - Location updates tiếp tục gửi lên server

2. **Theo Dõi Simulation**
   - Quan sát di chuyển
   - ✅ Kiểm tra:
     - Marker di chuyển mượt, đúng theo polyline
     - Polyline chỉ hiển thị phần còn lại
     - Console log progress mỗi 5%

3. **Đến Điểm Đến**
   - Chờ simulation đến dropoff location
   - ✅ Kiểm tra:
     - Simulation tự động dừng khi đến đích
     - Driver location gần với dropoff location

### Bước 6: Hoàn Thành Chuyến Đi
1. **Complete Ride Request**
   - Nhấn nút "Hoàn thành chuyến đi" trong bottom sheet
   - Xác nhận trong alert
   - ✅ Kiểm tra:
     - API call: `POST /api/v1/rides/complete-ride-request` với `rideId` và `rideRequestId`
     - Request status chuyển từ `ONGOING` → `COMPLETED`
     - Có notification về payment (nếu có)
     - Có notification "Passenger Dropped Off"

2. **Complete Ride**
   - Sau khi complete request, tự động complete ride
   - ✅ Kiểm tra:
     - API call: `POST /api/v1/shared-rides/{rideId}/complete` với body `{ "rideId": rideId }`
     - Ride status chuyển thành `COMPLETED`
     - Alert: "Chuyến đi đã hoàn thành"
     - Navigate về `DriverHomeScreen`
     - Active ride được clear

---

## 🚴 Flow Test Rider

### Bước 1: Đăng Nhập và Tìm Chuyến Đi
1. **Đăng nhập với tài khoản Rider**
   - Mở app (thiết bị khác hoặc tài khoản khác)
   - Chọn "Rider" mode
   - Đăng nhập với `rider@test.com` / `password123`
   - ✅ Kiểm tra: Đăng nhập thành công, chuyển đến `HomeScreen` (rider)

2. **Tìm Chuyến Đi Gần Bạn**
   - Ở `HomeScreen`, xem danh sách "Chuyến xe gần bạn"
   - ✅ Kiểm tra:
     - Hiển thị danh sách rides available
     - Mỗi ride có: driver name, route, price, available seats

### Bước 2: Đặt Chuyến Đi
1. **Tạo Booking Request**
   - Nhấn "Đặt xe ngay" hoặc chọn một ride từ danh sách
   - Chọn điểm đón (Pickup Location)
   - Chọn điểm đến (Dropoff Location)
   - Xem quote (giá ước tính)
   - Nhấn "Xác nhận đặt xe"
   - ✅ Kiểm tra:
     - Booking request được tạo
     - Status = `PENDING` hoặc `CONFIRMED` (nếu driver auto-accept)
     - Navigate đến `RiderMatchingScreen` hoặc `RideTrackingScreen`

2. **Chờ Driver Accept**
   - Ở màn hình matching/tracking
   - ✅ Kiểm tra:
     - Có WebSocket notification khi driver accept
     - Alert: "Chuyến đi được chấp nhận!"
     - Navigate đến `RideTrackingScreen`
     - Hiển thị thông tin driver và ride

### Bước 3: Theo Dõi Driver Di Chuyển
1. **Xem Driver Location**
   - Ở `RideTrackingScreen`
   - ✅ Kiểm tra:
     - Map hiển thị driver marker
     - Driver marker di chuyển theo real-time location từ server
     - Polyline từ driver đến pickup hiển thị
     - ETA được tính toán và hiển thị

2. **Khi Driver Đến Điểm Đón**
   - ✅ Kiểm tra:
     - Có notification "Driver đã đến điểm đón"
     - Driver marker ở gần pickup location

3. **Khi Driver Bắt Đầu Chuyến Đi**
   - ✅ Kiểm tra:
     - Polyline chuyển sang từ pickup đến dropoff
     - Driver marker tiếp tục di chuyển
     - ETA được cập nhật

4. **Khi Đến Điểm Đến**
   - ✅ Kiểm tra:
     - Driver marker ở gần dropoff location
     - Có notification "Đã đến điểm đến"
     - Ride status = `COMPLETED`

---

## 🔄 Flow Test Tích Hợp (End-to-End)

### Scenario 1: Driver Tạo Ride → Rider Book → Driver Accept → Complete
1. **Driver Side:**
   - Tạo shared ride với scheduled time = "Ngay bây giờ"
   - Ride status = `ONGOING`
   - Chờ ride request

2. **Rider Side:**
   - Tìm và book ride của driver
   - Request status = `PENDING` hoặc `CONFIRMED`

3. **Driver Side:**
   - Nhận notification về ride offer
   - Accept ride request
   - Navigate đến `DriverRideTrackingScreen`
   - Phase = `toPickup`
   - Simulate đến pickup location
   - Nhấn "Nhận khách"
   - Phase = `toDropoff`
   - Simulate đến dropoff location
   - Complete ride

4. **Rider Side:**
   - Theo dõi driver di chuyển real-time
   - Nhận notification khi driver đến pickup
   - Nhận notification khi driver đến dropoff
   - Ride completed

### Scenario 2: Driver Tạo Ride Scheduled → Rider Book → Driver Accept → Start Ride
1. **Driver Side:**
   - Tạo shared ride với scheduled time = "30 phút sau"
   - Ride status = `SCHEDULED`
   - Chờ ride request

2. **Rider Side:**
   - Book ride
   - Request status = `CONFIRMED`

3. **Driver Side:**
   - Accept ride request
   - Ride status vẫn = `SCHEDULED`
   - Khi đến scheduled time:
     - Nhận notification "Tracking started"
     - Navigate đến `DriverRideTrackingScreen`
     - Phase = `toPickup`
   - Simulate đến pickup
   - Nhấn "Nhận khách"
     - API call `startRide` (SCHEDULED → ONGOING)
     - API call `startRideRequestOfRide` (CONFIRMED → ONGOING)
   - Simulate đến dropoff
   - Complete ride

---

## ⚠️ Kiểm Tra Lỗi Thường Gặp

### 1. Lỗi "Driver is too far from pickup location"
**Nguyên nhân:**
- Location tracking chưa sync với backend
- Driver location chưa được gửi lên server

**Giải pháp:**
- Đợi 2-3 giây sau khi simulation đến pickup
- Kiểm tra console log xem location có đang gửi lên server không
- Kiểm tra WebSocket connection

**Test:**
- Simulate đến pickup
- Đợi 2 giây
- Nhấn "Nhận khách"
- ✅ Không có lỗi "too far"

### 2. Polyline Bị Giật/Re-render Liên Tục
**Nguyên nhân:**
- Polyline được update quá thường xuyên
- Không có throttle/debounce

**Giải pháp:**
- Đã implement throttle 500ms cho polyline updates
- Chỉ update khi polyline thực sự thay đổi

**Test:**
- Bắt đầu simulation
- Quan sát console log
- ✅ Không có log "Updating polyline" liên tục
- ✅ Polyline mượt mà, không giật

### 3. Simulation Không Đi Đúng Polyline
**Nguyên nhân:**
- Polyline decode sai
- Logic interpolation không đúng

**Giải pháp:**
- Đã sửa decode polyline để handle escaped backslashes
- Sử dụng time-based progress với interpolation giữa các điểm

**Test:**
- Bắt đầu simulation với polyline
- Quan sát driver marker
- ✅ Marker đi đúng theo đường polyline trên map
- ✅ Không đi thẳng (nếu có polyline)

### 4. Complete Ride Bị Lỗi
**Nguyên nhân:**
- Có ride request còn ONGOING
- Backend validation failed

**Giải pháp:**
- Tự động complete tất cả ONGOING requests trước
- Gửi đúng body format: `{ "rideId": rideId }`

**Test:**
- Complete ride sau khi đã đến dropoff
- ✅ Tất cả requests được complete trước
- ✅ Ride được complete thành công

### 5. Location Tracking Không Gửi Lên Server
**Nguyên nhân:**
- WebSocket không connected
- Ride status không phải ONGOING
- Simulation localOnly = true

**Giải pháp:**
- Đã set `localOnly: false` trong simulation config
- Kiểm tra WebSocket connection
- Kiểm tra ride status

**Test:**
- Bắt đầu simulation
- Kiểm tra console log: `📍 Sent X location points via WebSocket`
- ✅ Location được gửi lên server

---

## 📊 Checklist Test

### Driver Flow
- [ ] Đăng nhập thành công
- [ ] Tạo shared ride thành công
- [ ] Nhận ride offer notification
- [ ] Accept ride request thành công
- [ ] Navigate đến tracking screen
- [ ] Polyline hiển thị đúng
- [ ] Simulation bắt đầu thành công
- [ ] Driver marker di chuyển mượt
- [ ] Polyline tự động cắt từ vị trí hiện tại
- [ ] Location updates gửi lên server
- [ ] Đến pickup location
- [ ] Nhận khách thành công (không lỗi "too far")
- [ ] Phase chuyển sang toDropoff
- [ ] Polyline chuyển sang pickup→dropoff
- [ ] Simulation đến dropoff thành công
- [ ] Complete ride request thành công
- [ ] Complete ride thành công
- [ ] Navigate về home screen

### Rider Flow
- [ ] Đăng nhập thành công
- [ ] Xem danh sách rides available
- [ ] Tạo booking request thành công
- [ ] Nhận notification khi driver accept
- [ ] Navigate đến tracking screen
- [ ] Xem driver location real-time
- [ ] Polyline hiển thị đúng
- [ ] Driver marker di chuyển
- [ ] Nhận notification khi driver đến pickup
- [ ] Nhận notification khi driver đến dropoff
- [ ] Ride completed

### Integration Flow
- [ ] Driver tạo ride → Rider thấy trong danh sách
- [ ] Rider book → Driver nhận notification
- [ ] Driver accept → Rider nhận notification
- [ ] Driver simulate → Rider thấy driver di chuyển
- [ ] Driver complete → Rider nhận notification

---

## 🔍 Debug Tips

### Console Logs Quan Trọng
```
📍 Simulation update: {...}           // Mỗi 1 giây
📍 Simulation progress: X%            // Mỗi 5%
📍 Updating polyline on map            // Khi polyline thay đổi
📍 Sent X location points via WebSocket // Khi gửi location lên server
🔄 Starting ride request...            // Khi nhận khách
✅ Started ride request...              // Khi nhận khách thành công
🔄 Completing ride request...          // Khi complete request
✅ Completed ride request...            // Khi complete request thành công
🔄 Completing ride...                  // Khi complete ride
✅ Successfully completed ride          // Khi complete ride thành công
```

### Kiểm Tra WebSocket
- Console log: `STOMP Debug: >>> SEND` - Gửi location data
- Console log: `STOMP Debug: <<< MESSAGE` - Nhận notification
- Kiểm tra destination: `/app/ride.track.{rideId}`

### Kiểm Tra API Calls
- `POST /api/v1/rides/{rideId}/start` - Start ride
- `POST /api/v1/rides/start-ride-request` - Start ride request
- `POST /api/v1/rides/complete-ride-request` - Complete ride request
- `POST /api/v1/shared-rides/{rideId}/complete` - Complete ride

---

## 📝 Notes

1. **Simulation Speed**: Hiện tại set ở 50 m/s (~180km/h) và update mỗi 100ms để test nhanh
2. **Polyline Trimming**: Polyline tự động cắt từ điểm gần nhất với vị trí hiện tại
3. **Location Sync**: Có delay 2 giây trước khi nhận khách để đảm bảo location đã sync với backend
4. **Error Handling**: Tất cả errors đều có thông báo rõ ràng cho user

---

## 🐛 Troubleshooting

### Nếu simulation không chạy:
- Kiểm tra console log có lỗi gì không
- Kiểm tra polyline có được decode đúng không
- Kiểm tra start/end coordinates có hợp lệ không

### Nếu polyline không hiển thị:
- Kiểm tra polyline string có đúng format không
- Kiểm tra decode polyline có thành công không
- Kiểm tra mapPolyline state có được set không

### Nếu location không gửi lên server:
- Kiểm tra WebSocket connection
- Kiểm tra ride status có phải ONGOING không
- Kiểm tra `localOnly` có phải `false` không

### Nếu complete ride bị lỗi:
- Kiểm tra có ride request nào còn ONGOING không
- Kiểm tra body format có đúng `{ "rideId": rideId }` không
- Kiểm tra backend logs để xem lỗi chi tiết

---

**Chúc bạn test thành công! 🎉**

