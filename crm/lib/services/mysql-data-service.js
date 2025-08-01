const { executeQuery, getDatabaseInfo, testConnection } = require('../database/mysql-connection');

class MySQLDataService {
  constructor() {
    this.isConnected = false;
  }

  // 연결 초기화
  async initialize() {
    try {
      this.isConnected = await testConnection();
      if (this.isConnected) {
        const dbInfo = await getDatabaseInfo();
        console.log('MySQL 데이터베이스 정보:', dbInfo);
      }
      return this.isConnected;
    } catch (error) {
      console.error('MySQL 초기화 실패:', error);
      return false;
    }
  }

  // 회사 정보 조회
  async getCompanies(limit = 100, offset = 0) {
    const sql = `
      SELECT 
        id, email, name, charger, contacts, 
        createdAt, updatedAt, last_login
      FROM Companies 
      WHERE is_active = 1
      ORDER BY createdAt DESC 
      LIMIT ? OFFSET ?
    `;
    return await executeQuery(sql, [limit, offset]);
  }

  // 특정 회사 정보 조회
  async getCompanyById(companyId) {
    const sql = `
      SELECT * FROM Companies 
      WHERE id = ? AND is_active = 1
    `;
    const result = await executeQuery(sql, [companyId]);
    return result[0] || null;
  }

  // 광고 목록 조회
  async getAds(companyId = null, limit = 100, offset = 0) {
    let sql = `
      SELECT 
        a.id, a.name, a.companyId, a.category, a.verified,
        a.createdAt, a.updatedAt, c.name as companyName
      FROM Ads a
      LEFT JOIN Companies c ON a.companyId = c.id
    `;
    const params = [];

    if (companyId) {
      sql += ' WHERE a.companyId = ?';
      params.push(companyId);
    }

    sql += ' ORDER BY a.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await executeQuery(sql, params);
  }

  // 계약 정보 조회
  async getContracts(companyId = null, limit = 100, offset = 0) {
    let sql = `
      SELECT 
        c.id, c.company, c.companyName, c.currentState,
        c.user, c.userEmail, c.createdAt, c.updatedAt,
        a.name as adName
      FROM Contracts c
      LEFT JOIN Ads a ON c.company = a.id
    `;
    const params = [];

    if (companyId) {
      sql += ' WHERE c.company IN (SELECT id FROM Ads WHERE companyId = ?)';
      params.push(companyId);
    }

    sql += ' ORDER BY c.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await executeQuery(sql, params);
  }

  // 사용자 정보 조회
  async getUsers(limit = 100, offset = 0) {
    const sql = `
      SELECT 
        uid, email, displayName, phone, level, type,
        signupAt, lastLogin, updatedAt
      FROM Users 
      WHERE agreement = 1
      ORDER BY signupAt DESC 
      LIMIT ? OFFSET ?
    `;
    return await executeQuery(sql, [limit, offset]);
  }

  // 키워드 랭킹 히스토리 조회
  async getKeywordRankHistory(keywordId, limit = 30) {
    const sql = `
      SELECT 
        krh.id, krh.date, krh.rank, krh.level,
        k.name as keywordName
      FROM KeywordRankHistories krh
      LEFT JOIN Keywords k ON krh.keywordId = k.id
      WHERE krh.keywordId = ?
      ORDER BY krh.date DESC
      LIMIT ?
    `;
    return await executeQuery(sql, [keywordId, limit]);
  }

  // 문의사항 조회
  async getInquiries(limit = 100, offset = 0) {
    const sql = `
      SELECT 
        i.id, i.uid, i.category, i.subCategory,
        i.contentText, i.isAnswered, i.createdAt,
        COUNT(a.id) as answerCount
      FROM App_Inquiry i
      LEFT JOIN App_Inquiry_Answer a ON i.id = a.inquiryId
      GROUP BY i.id
      ORDER BY i.createdAt DESC
      LIMIT ? OFFSET ?
    `;
    return await executeQuery(sql, [limit, offset]);
  }

  // 결제 정보 조회
  async getPayments(companyId = null, limit = 100, offset = 0) {
    let sql = `
      SELECT 
        ap.id, ap.adId, ap.amount, ap.payState,
        ap.payMethod, ap.paidAt, ap.createdAt,
        a.name as adName, c.name as companyName
      FROM Ads_Payment ap
      LEFT JOIN Ads a ON ap.adId = a.id
      LEFT JOIN Companies c ON a.companyId = c.id
    `;
    const params = [];

    if (companyId) {
      sql += ' WHERE a.companyId = ?';
      params.push(companyId);
    }

    sql += ' ORDER BY ap.createdAt DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await executeQuery(sql, params);
  }

  // 통계 데이터 조회
  async getStatistics() {
    const queries = [
      'SELECT COUNT(*) as totalCompanies FROM Companies WHERE is_active = 1',
      'SELECT COUNT(*) as totalAds FROM Ads',
      'SELECT COUNT(*) as totalContracts FROM Contracts',
      'SELECT COUNT(*) as totalUsers FROM Users WHERE agreement = 1',
      'SELECT COUNT(*) as totalInquiries FROM App_Inquiry',
      `SELECT 
         DATE(createdAt) as date, 
         COUNT(*) as count 
       FROM Companies 
       WHERE createdAt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY DATE(createdAt) 
       ORDER BY date DESC`
    ];

    const results = await Promise.all(
      queries.map(sql => executeQuery(sql))
    );

    return {
      totalCompanies: results[0][0].totalCompanies,
      totalAds: results[1][0].totalAds,
      totalContracts: results[2][0].totalContracts,
      totalUsers: results[3][0].totalUsers,
      totalInquiries: results[4][0].totalInquiries,
      dailySignups: results[5]
    };
  }

  // 검색 기능
  async searchCompanies(searchTerm, limit = 50) {
    const sql = `
      SELECT 
        id, email, name, charger, contacts, createdAt
      FROM Companies 
      WHERE (
        name LIKE ? OR 
        email LIKE ? OR 
        charger LIKE ?
      ) AND is_active = 1
      ORDER BY createdAt DESC 
      LIMIT ?
    `;
    const searchPattern = `%${searchTerm}%`;
    return await executeQuery(sql, [searchPattern, searchPattern, searchPattern, limit]);
  }

  // 데이터 내보내기 (CSV 형태)
  async exportData(tableName, conditions = {}, limit = 1000) {
    let sql = `SELECT * FROM ${tableName}`;
    const params = [];

    if (Object.keys(conditions).length > 0) {
      const whereClause = Object.keys(conditions)
        .map(key => `${key} = ?`)
        .join(' AND ');
      sql += ` WHERE ${whereClause}`;
      params.push(...Object.values(conditions));
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    return await executeQuery(sql, params);
  }
}

module.exports = new MySQLDataService(); 