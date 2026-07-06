<div align="center">

# 🗺️ [Wanderland](https://wanderland-two.vercel.app/) 🗺️

*유저 피드백 기반 하이퍼로컬 카페 탐색 웹앱*

</div>

<br>

## 📌 Overview
> 키워드와 위치를 기반으로 주변 카페를 빠르게 탐색할 수 있는 웹앱입니다.  
> 실제 유저 피드백을 수집하고 지표를 보며 서비스를 점진적으로 개선하는 과정을 경험하기 위해 기획했습니다.

<br>

## ✨ Features
- 키워드 기반 주변 카페 검색
- 위치 직접 지정 (Kakao Maps API)
- Google·Naver 데이터 교차 연동을 통한 검색 품질 개선
- 인기 매장 기준 '트렌드 정렬' 탭
- 유저 검색어·피드백 모니터링 대시보드

<br>

## 🛠️ Tech Stack & Architecture
- **Frontend:** HTML, CSS, JavaScript
- **External API:** Google Maps, Naver Maps, Kakao Maps
- **Caching:** Upstash Redis
- **Data Storage:** Google Sheets API
- **Deployment:** Vercel
- **AI Tool:** Claude (프로토타입 빌드업)

<br>

<img width="834" height="391" alt="wanderland3 drawio" src="https://github.com/user-attachments/assets/879e11ed-49f0-4e8d-b59f-edff52bdd46b" />

<br>

## ⚡ How it Works
### 1. Redis 캐싱을 통한 API 비용 절감
Google Places API 반복 호출로 인한 비용/응답속도 문제를 Redis 캐싱(TTL 24시간)으로 해결했습니다. '검색 키워드 + 반경' 조합을 캐시 키로 설계해 캐시 충돌도 방지했습니다.

### 2. Google·Naver 하이브리드 검색
Google 단독 검색 시 한국어 리뷰 부족 문제를 Naver 지역 API 교차 연동으로 해결했습니다.

<br>

## 📅 Progress
- 2026.05.07 : MVP 개발 (Google Places API 기반 카페 검색)
- 2026.05.08 : 피드백 수집 및 대시보드 구축, Redis 캐싱 도입
- 2026.05.13 : Naver API 교차 연동, 반경별 캐시 충돌 방지
- 2026.05.16 : 위치 직접 선택 기능 추가, 카페 저장 기능
- 진행 중 : Supabase 연동으로 데이터 영속성 확보
