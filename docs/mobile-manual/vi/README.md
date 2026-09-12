# Hướng dẫn sử dụng máy quét hiện trường (PDA)

Cách dùng máy quét cầm tay dùng trong kho và tại hiện trường. Việc nhận vật tư, chuyển đi, xuất ra và kiểm tra thiết bị đều ghi bằng máy này.

Phần lớn màn hình đi theo trình tự **quét trước, rồi nhập số lượng, cuối cùng bấm nút**.

## Giới thiệu hướng dẫn

Hướng dẫn này chia làm ba phần. **Hãy đọc lần lượt từ trên xuống.**

| Tình huống                       | Tài liệu                                         | Nội dung                                                                                     |
| -------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Dùng lần đầu**                 | [Toàn bộ luồng công việc](00-빠른-시작.md)       | Toàn bộ luồng từ lúc vật tư vào đến lúc thành phẩm ra. Chỉ tài liệu này cũng đủ làm việc cơ bản |
| **Gặp sự cố khi làm việc**       | [Xử lý sự cố](예외-상황.md)                      | Cách xử lý ngoại lệ theo tình huống. Không biết tên màn hình vẫn tìm được                     |
| **Xem chi tiết từng màn hình**   | Các tài liệu theo màn hình bên dưới              | Toàn bộ các bước và mọi thông báo của màn hình đó                                             |

Tài liệu này tập hợp **các thao tác dùng giống nhau ở mọi màn hình**. Cách quét, cách nhập số lượng, cách quay lại bước trước.

### Tài liệu theo màn hình

| Công việc                                                        | Tài liệu                                       |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| Nhập kho · bảo quản · xuất kho vật tư                            | [Kho vật tư](01-자재창고.md)                   |
| Chuyển công đoạn của hàng đang sản xuất                          | [Chuyển sản xuất · sửa chữa](02-생산이동.md)   |
| Nhập kho · lấy hàng · đổi đóng gói thành phẩm                    | [Xuất hàng](04-출하.md)                        |
| Kiểm tra định kỳ và báo hỏng thiết bị                            | [Thiết bị](05-설비.md)                         |
| Cài đặt máy quét lần đầu · xác nhận mã nhân viên · xem bản ghi gửi thất bại | [Màn hình dùng chung](공통-화면.md) |

---

## Hướng dẫn dùng lần đầu

### Màn hình khởi động của máy quét

Mở máy quét thì hiện **danh sách công việc**. Chọn công việc cần làm ở đây.

![Toàn bộ màn hình danh sách công việc. Dưới chín nhóm nhập hàng, cất hàng, lấy hàng/xuất kho, yêu cầu gấp, kiểm kê, chuyển sản xuất/sửa chữa, quét xuất hàng, thiết bị, trạng thái gửi là hai mươi màn hình được liệt kê](images-vi/00-작업목록.png)

Công việc chia thành **chín nhóm**. **Nhập hàng** dùng khi hàng vào, **Cất hàng** dùng khi đưa vào vị trí bảo quản, **Lấy hàng / Xuất kho** dùng khi lấy hàng ra để đưa đi.

### Việc cần kiểm trước khi bắt đầu

**Hãy kiểm xem có đúng mã nhân viên của mình không.** Trên cùng màn hình hiện tên và mã nhân viên của người đang làm.

![Dòng trên cùng màn hình. Bên trái là tên màn hình đăng ký nhập hàng, giữa là Nguyễn Văn An · 100027, bên phải là dấu trực tuyến màu xanh](images-vi/공통-08-머리말.png)

Mọi ghi nhận đều mang mã nhân viên hiện ở đây. Vì nhiều người dùng luân phiên chung một máy quét, nên **nếu mã nhân viên của người trước còn nguyên thì việc mình làm sẽ được ghi dưới tên người đó.**

Nếu là mã nhân viên của người khác thì hãy [đổi mã nhân viên](공통-화면.md#xác-nhận-mã-nhân-viên) trước.

### Các mục hiện trên đầu màn hình

| Hiển thị                  | Nghĩa                                                          |
| ------------------------- | -------------------------------------------------------------- |
| Tên màn hình              | Đang ở màn hình nào                                            |
| `Nguyễn Văn An · 100027`  | Người làm sẽ được ghi nhận                                     |
| `Trực tuyến`              | Đang kết nối với máy chủ. Mất kết nối thì đổi thành `Ngoại tuyến` |

Có bản ghi chưa gửi được thì hiện kèm `Chờ gửi 1`, có bản ghi đã gửi mà máy chủ không nhận thì hiện kèm `Gửi thất bại 1` bên cạnh.

![Trên màn hình hiện cùng lúc ngoại tuyến và chờ gửi 1](images-vi/공통-07-전송대기.png)

---

## Thao tác dùng chung

### 1. Quét

Ô nhập để đọc nhãn có viền đỏ. Trong lúc con trỏ nằm ở ô này thì **chỉ cần bấm nút quét của máy** là giá trị được nhập. Không cần chạm màn hình hay mở bàn phím.

![Màn hình đầu của đăng ký nhập hàng. Ô nhập viền đỏ với câu hãy quét nhãn LOT vật tư, dưới là nút nhập tay](images-vi/01-입하등록-1-스캔.png)

Bấm vào ô nhập này thì bàn phím cũng không hiện lên. Vì bàn phím che nửa màn hình sẽ che mất danh sách và nút ở dưới.

### 2. Nhập tay khi không nhận dạng được nhãn

Nhãn bị rách hoặc bẩn khiến máy không đọc được thì hãy bấm **Nhập tay**.

![Sau khi bấm nhập tay. Ô vừa định quét chuyển thành ô nhập tay được và nút bên dưới đổi thành đưa vào](images-vi/공통-03-직접입력.png)

- Ô nhập mới không sinh thêm. **Chính ô vừa định quét** chuyển thành nhập tay được và bàn phím hiện lên.
- Nhập xong thì bấm nút bên dưới.
- **Đang nhập mà quét bằng máy thì giá trị quét được áp dụng.** Nội dung đang nhập bị xóa.

Tên nút để đưa giá trị vào hơi khác nhau tùy màn hình. Phần lớn là **Đưa vào**, cũng có màn hình ghi rõ đang nhập cái gì.

| Tên nút                                                            | Màn hình dùng                                   |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| **Đưa vào**                                                        | Phần lớn màn hình                               |
| **Tìm**                                                            | Lấy hàng thành phẩm · Đăng ký vật tư tái chế    |
| **Đưa thẻ nhận diện vào** · **Đưa vị trí vào**                     | Nhập kho và cất hàng thành phẩm                 |
| **Dùng vị trí đã nhập** · **Dùng LOT đã nhập**                     | Cất hàng và hoàn tất nhập kho                   |
| **Tìm theo giá trị đã nhập**                                       | Quét đưa vào và lấy ra sửa chữa                 |

### 3. Nhập số lượng

Cách nhập số lượng chia làm hai kiểu tùy màn hình.

**Bàn phím số trong màn hình** — Phần lớn màn hình dùng kiểu này. Bấm vào ô nhập số lượng thì bàn phím số mở ra ngay bên dưới.

![Ô nhập số lượng thực nhận của đăng ký nhập hàng và bàn phím số mở bên dưới. Phía dưới có câu màu xanh khớp với phần dự kiến còn lại](images-vi/01-입하등록-5-수량.png)

- `C` là xóa hết, `⌫` là xóa một ký tự.
- Ở màn hình nhập số lượng cho nhiều dòng thì bàn phím chỉ mở **ngay dưới dòng đang nhập**. Bấm sang dòng khác thì bàn phím chuyển sang dòng đó.

**Bàn phím của máy** — Chỉ hai màn hình **Chuyển tồn kho** và **Đếm thực tế** dùng bàn phím của máy. Bấm vào ô nhập số lượng thì bàn phím hiện lên và che phần dưới màn hình. **Phải nhập xong rồi đóng bàn phím mới thấy nút hoàn tất.**

### 4. Mục bắt buộc nhập

Mục có `(bắt buộc)` sau tên thì nhất định phải nhập. Để trống thì nút hoàn tất không bấm được, và phía dưới màn hình sẽ báo đang thiếu cái gì.

### 5. Lưu bản ghi không sửa lại được

Bản ghi không sửa hay xóa được thì trước khi lưu sẽ hỏi lại một lần.

![Cửa sổ xác nhận có tiêu đề đăng ký rồi thì không sửa được. Có hai nút quay lại và đăng ký](images-vi/공통-04-확인대화.png)

Xem lại nội dung rồi bấm **Đăng ký**. Bấm **Quay lại** thì không lưu và về màn hình trước.

Bấm nút hoàn tất nhiều lần thì bản ghi vẫn chỉ gửi một lần. Không bị ghi trùng.

### 6. Quay lại

Nút quay lại của máy không thoát hẳn khỏi màn hình mà chỉ lùi **đúng một bước**. Ví dụ đang chọn đối tượng rồi nhập số lượng thì lựa chọn được bỏ và chọn lại từ đối tượng. Chỉ khi không còn bước nào để lùi thì mới ra danh sách công việc.

Lý do hay ghi chú đã nhập tay thì quay lại cũng không bị xóa.

Các màn hình dưới đây không có kiểu lùi từng bước này. Bấm quay lại một lần là ra danh sách công việc và **giá trị đang nhập biến mất.** Giá trị nhập sai thì hãy sửa ngay tại màn hình đó.

> Đăng ký nhập hàng · Chuyển tồn kho · Đếm thực tế · Đăng ký vật tư tái chế · Kiểm tra vị trí vật tư · Bản ghi gửi thất bại · Đăng ký máy

Ở danh sách công việc bấm quay lại thì về **màn hình xác nhận mã nhân viên**. Khi đổi ca thì đổi mã nhân viên ở màn hình này. Bấm thêm một lần nữa thì ứng dụng đóng.

Bản ghi chưa gửi được thì đóng ứng dụng vẫn còn trong máy quét, mở lại là gửi tiếp.

---

## Khi mất kết nối mạng

Trong nhà máy có chỗ sóng yếu. Mất kết nối thì dấu trên màn hình đổi thành `Ngoại tuyến`. Lúc đó màn hình chạy theo một trong ba kiểu.

### Màn hình không vào được

Màn hình mà nội dung cần lưu chỉ máy chủ mới kiểm được thì chặn ngay từ lúc vào. Vì làm hết việc rồi mới bị chặn ở bước lưu thì phải làm lại từ đầu.

![Màn hình lấy hàng thành phẩm. Câu đang ngoại tuyến nên không lấy hàng được và nút thử lại](images-vi/공통-06-오프라인차단.png)

Hãy sang chỗ có kết nối rồi bấm **Thử lại**.

Các màn hình đó — **Chuyển công đoạn WIP**, **Quét đưa vào và lấy ra sửa chữa**, **Lấy hàng thành phẩm**

### Màn hình chỉ hạn chế phần tra cứu

Vào được màn hình nhưng không tải được danh sách. Lúc đó màn hình sẽ báo là không tải được cái gì.

![Màn hình báo hỏng thiết bị ở trạng thái ngoại tuyến. Câu đỏ không tải được danh sách thiết bị, kèm câu có kết nối sẽ báo, gấp thì hãy liên hệ trực tiếp](images-vi/19-설비고장-2-오프라인.png)

### Màn hình lưu vào diện chờ gửi

Nội dung đã nhập được lưu trong máy quét, có kết nối thì gửi. Lúc đó màn hình không hiện `hoàn tất` mà hiện **Chờ gửi**.

![Màn hình báo đã đưa đăng ký vật tư tái chế vào hàng chờ gửi. Phía trên thấy ngoại tuyến và chờ gửi 1](images-vi/공통-07-전송대기.png)

**Chờ gửi nghĩa là chưa đến được máy chủ.** Còn bao nhiêu bản ghi thì xem ở dấu trên màn hình.

Những bản ghi **người khác đang đợi** như yêu cầu gấp hay sự cố thiết bị thì màn hình vẫn hiện câu báo đang chờ. Trường hợp gấp thì hãy báo thêm bằng điện thoại.

### Bản ghi đã gửi mà không được đăng ký

`Gửi thất bại` khác với `Chờ gửi`. Bản ghi chờ thì đợi sẽ gửi, còn bản ghi thất bại thì **đợi cũng không gửi.** Phải xem nguyên nhân rồi làm lại việc đó.

→ [Bản ghi gửi thất bại](공통-화면.md#bản-ghi-gửi-thất-bại)

---

## Giải thích thuật ngữ

| Thuật ngữ              | Nghĩa                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| LOT                    | Một lô làm ra trong cùng điều kiện. Mỗi vật tư, thành phẩm đều có số riêng                  |
| Số LOT vật tư          | Dãy 34 chữ số do nhà cung cấp dán sẵn                                                       |
| Thẻ nhận diện (HU)     | Mã QR dán trên thùng hoặc pallet chứa thành phẩm. Bên trong có gì, bao nhiêu đều đã định sẵn |
| Cất hàng               | Việc đưa hàng đã nhận vào vị trí bảo quản đã định                                           |
| Lấy hàng               | Việc lấy hàng sắp đi ra khỏi vị trí bảo quản và gom lại                                     |
| Tạm giữ                | Trạng thái chưa kiểm tra chất lượng xong nên chưa dùng được                                 |
| ERP W/O                | Số đơn đặt mua. Ghi đã quyết mua cái gì, bao nhiêu                                          |
| Dự kiến còn lại        | Số lượng còn phải nhận thêm, bằng số đặt hàng trừ đi số đã nhận đến giờ                     |
| IQC                    | Kiểm tra đầu vào. Kiểm xem vật tư vào có dùng được không                                    |
