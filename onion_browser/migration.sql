CREATE TABLE IF NOT EXISTS `onion_annonces` (
   `id` INT NOT NULL AUTO_INCREMENT,
   `citizenid` VARCHAR(50) NOT NULL,
    `title` VARCHAR(20) NOT NULL,
    `message` VARCHAR(140) NOT NULL,
    `contact` VARCHAR(13) NOT NULL,
    `author` VARCHAR(16) NOT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `citizenid_idx` (`citizenid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



-- Crée la table des ventes BlackBay
CREATE TABLE IF NOT EXISTS `blackbay_sales` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `citizenid` VARCHAR(60) NOT NULL,
  `item` VARCHAR(64) NOT NULL,
  `qty` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `price` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_ts` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_citizenid` (`citizenid`),
  KEY `idx_created` (`created_ts`),
  KEY `idx_citizenid_created` (`citizenid`, `created_ts`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
