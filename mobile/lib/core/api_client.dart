import 'package:dio/dio.dart';
import 'session.dart';

class ApiClient {
  ApiClient(this.session)
      : dio = Dio(
          BaseOptions(
            baseUrl: const String.fromEnvironment(
              'API_BASE',
              defaultValue: 'http://10.0.2.2:4000/api/v1',
            ),
            connectTimeout: const Duration(seconds: 8),
            receiveTimeout: const Duration(seconds: 12),
          ),
        ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = session.token;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final SessionStore session;
  final Dio dio;

  Future<dynamic> get(String path, [Map<String, dynamic>? query]) async {
    final response = await dio.get(path, queryParameters: query);
    return response.data['data'];
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final response = await dio.post(path, data: body);
    return response.data['data'];
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final response = await dio.patch(path, data: body);
    return response.data['data'];
  }
}
