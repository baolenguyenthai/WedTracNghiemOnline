CREATE TABLE `nguoi_dung` (
  `nguoi_dung_id` INT NOT NULL AUTO_INCREMENT,
  `ten_dang_nhap` VARCHAR(191) NOT NULL,
  `mat_khau` VARCHAR(191) NOT NULL,
  `ho_ten` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `vai_tro` VARCHAR(191) NOT NULL DEFAULT 'USER',
  `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `reset_token_hash` VARCHAR(191) NULL,
  `reset_token_expires_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `nguoi_dung_ten_dang_nhap_key` (`ten_dang_nhap`),
  UNIQUE INDEX `nguoi_dung_email_key` (`email`),
  PRIMARY KEY (`nguoi_dung_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cap_hoc` (
  `cap_hoc_id` INT NOT NULL AUTO_INCREMENT,
  `ten_cap_hoc` VARCHAR(191) NOT NULL,
  UNIQUE INDEX `cap_hoc_ten_cap_hoc_key` (`ten_cap_hoc`),
  PRIMARY KEY (`cap_hoc_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `mon_hoc` (
  `mon_hoc_id` INT NOT NULL AUTO_INCREMENT,
  `ten_mon_hoc` VARCHAR(191) NOT NULL,
  UNIQUE INDEX `mon_hoc_ten_mon_hoc_key` (`ten_mon_hoc`),
  PRIMARY KEY (`mon_hoc_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bo_cau_hoi` (
  `bo_cau_hoi_id` INT NOT NULL AUTO_INCREMENT,
  `ten_bo_cau_hoi` VARCHAR(191) NOT NULL,
  `mo_ta` VARCHAR(191) NULL,
  `cap_hoc_id` INT NOT NULL,
  `mon_hoc_id` INT NOT NULL,
  `nguoi_tao` INT NOT NULL,
  `trang_thai` VARCHAR(191) NOT NULL DEFAULT 'CHO_DUYET',
  `cong_khai` BOOLEAN NOT NULL DEFAULT false,
  `so_cau_mac_dinh` INT NULL,
  `thoi_gian_thi_phut` INT NULL,
  `ngay_tao` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `bo_cau_hoi_cap_hoc_id_mon_hoc_id_trang_thai_idx` (`cap_hoc_id`, `mon_hoc_id`, `trang_thai`),
  PRIMARY KEY (`bo_cau_hoi_id`),
  CONSTRAINT `bo_cau_hoi_cap_hoc_id_fkey` FOREIGN KEY (`cap_hoc_id`) REFERENCES `cap_hoc` (`cap_hoc_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bo_cau_hoi_mon_hoc_id_fkey` FOREIGN KEY (`mon_hoc_id`) REFERENCES `mon_hoc` (`mon_hoc_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `bo_cau_hoi_nguoi_tao_fkey` FOREIGN KEY (`nguoi_tao`) REFERENCES `nguoi_dung` (`nguoi_dung_id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cau_hoi` (
  `cau_hoi_id` INT NOT NULL AUTO_INCREMENT,
  `bo_cau_hoi_id` INT NOT NULL,
  `noi_dung` LONGTEXT NOT NULL,
  `muc_do` VARCHAR(191) NOT NULL DEFAULT 'TB',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `cau_hoi_bo_cau_hoi_id_idx` (`bo_cau_hoi_id`),
  PRIMARY KEY (`cau_hoi_id`),
  CONSTRAINT `cau_hoi_bo_cau_hoi_id_fkey` FOREIGN KEY (`bo_cau_hoi_id`) REFERENCES `bo_cau_hoi` (`bo_cau_hoi_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `dap_an` (
  `dap_an_id` INT NOT NULL AUTO_INCREMENT,
  `cau_hoi_id` INT NOT NULL,
  `noi_dung` LONGTEXT NOT NULL,
  `dung` BOOLEAN NOT NULL DEFAULT false,
  INDEX `dap_an_cau_hoi_id_dung_idx` (`cau_hoi_id`, `dung`),
  PRIMARY KEY (`dap_an_id`),
  CONSTRAINT `dap_an_cau_hoi_id_fkey` FOREIGN KEY (`cau_hoi_id`) REFERENCES `cau_hoi` (`cau_hoi_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `cau_hoi_yeu_thich` (
  `nguoi_dung_id` INT NOT NULL,
  `cau_hoi_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`nguoi_dung_id`, `cau_hoi_id`),
  CONSTRAINT `cau_hoi_yeu_thich_nguoi_dung_id_fkey` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung` (`nguoi_dung_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `cau_hoi_yeu_thich_cau_hoi_id_fkey` FOREIGN KEY (`cau_hoi_id`) REFERENCES `cau_hoi` (`cau_hoi_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `bai_thi` (
  `bai_thi_id` INT NOT NULL AUTO_INCREMENT,
  `nguoi_dung_id` INT NOT NULL,
  `bo_cau_hoi_id` INT NOT NULL,
  `tong_cau` INT NOT NULL,
  `so_cau_dung` INT NOT NULL DEFAULT 0,
  `diem` DOUBLE NOT NULL DEFAULT 0,
  `thoi_gian_bat_dau` DATETIME(3) NOT NULL,
  `thoi_gian_ket_thuc` DATETIME(3) NULL,
  `thoi_luong_giay` INT NULL,
  `cong_khai` BOOLEAN NOT NULL DEFAULT false,
  INDEX `bai_thi_nguoi_dung_id_bo_cau_hoi_id_thoi_gian_ket_thuc_idx` (`nguoi_dung_id`, `bo_cau_hoi_id`, `thoi_gian_ket_thuc`),
  PRIMARY KEY (`bai_thi_id`),
  CONSTRAINT `bai_thi_nguoi_dung_id_fkey` FOREIGN KEY (`nguoi_dung_id`) REFERENCES `nguoi_dung` (`nguoi_dung_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `bai_thi_bo_cau_hoi_id_fkey` FOREIGN KEY (`bo_cau_hoi_id`) REFERENCES `bo_cau_hoi` (`bo_cau_hoi_id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `chi_tiet_bai_thi` (
  `chi_tiet_bai_thi_id` INT NOT NULL AUTO_INCREMENT,
  `bai_thi_id` INT NOT NULL,
  `cau_hoi_id` INT NOT NULL,
  `dap_an_da_chon` INT NULL,
  `dung` BOOLEAN NULL,
  `cau_hoi_text` LONGTEXT NOT NULL,
  `dap_an_dung_text` LONGTEXT NULL,
  `dap_an_chon_text` LONGTEXT NULL,
  INDEX `chi_tiet_bai_thi_bai_thi_id_cau_hoi_id_idx` (`bai_thi_id`, `cau_hoi_id`),
  PRIMARY KEY (`chi_tiet_bai_thi_id`),
  CONSTRAINT `chi_tiet_bai_thi_bai_thi_id_fkey` FOREIGN KEY (`bai_thi_id`) REFERENCES `bai_thi` (`bai_thi_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chi_tiet_bai_thi_cau_hoi_id_fkey` FOREIGN KEY (`cau_hoi_id`) REFERENCES `cau_hoi` (`cau_hoi_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `chi_tiet_bai_thi_dap_an_da_chon_fkey` FOREIGN KEY (`dap_an_da_chon`) REFERENCES `dap_an` (`dap_an_id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `chi_tiet_bai_thi_dap_an_da_chon_idx` ON `chi_tiet_bai_thi` (`dap_an_da_chon`);
